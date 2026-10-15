/**
 * Consequential voice actions: propose, then commit.
 *
 * Split in two on purpose. A `propose_*` tool validates the request against live data,
 * prices it from the real `Doctor.fees`, and returns a confirmation sentence plus a
 * `pendingAction` record — but changes nothing. The gateway stores that record; only after
 * the patient confirms does it call the matching `execute_*` entry point **with the stored
 * parameters**. The `execute_*` tools are never declared to the model.
 *
 * That shape is what makes the guarantees in the plan real:
 *   · nothing is booked or cancelled on the model's own initiative
 *   · the committed parameters are the ones the patient heard read back
 *   · a repeated confirmation cannot double-execute, because the gateway claims the
 *     pending record once
 *
 * Every function here derives identity from the session cookie through the existing server
 * actions. None of them accepts a user id.
 */

import prisma from '@/lib/prisma'
import { getSessionId } from '@/lib/auth'
import {
    bookAppointment,
    cancelAppointment,
    rescheduleAppointment,
} from '@/app/actions/userActions'
import { generateSlots, formatSlotDateKey, toSlotMap } from '@/lib/schedule'
import { appointmentStatus, formatSlotDateTime } from '@/lib/appointment'
import type { ToolArgs, ToolOutcome } from './execute'

export type PendingActionDraft = {
    action: 'book' | 'cancel' | 'reschedule'
    params: Record<string, string>
    /** What the agent must read back, built entirely from backend values. */
    summary: string
}

function bad(error: string): ToolOutcome {
    return { ok: false, data: { error } }
}

function str(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}

/** Confirms a slot is one the doctor genuinely offers and is still free. */
function slotIsOpen(
    doctor: {
        availableDays?: unknown
        slotStartTime?: string | null
        slotEndTime?: string | null
        slotDuration?: number | null
        slots_booked?: unknown
    },
    slotDate: string,
    slotTime: string,
): { open: boolean; reason?: string; remaining?: string[] } {
    const days = generateSlots(doctor)
    const day = days.find(
        (slots) => slots.length > 0 && formatSlotDateKey(slots[0].datetime) === slotDate,
    )
    if (!day) return { open: false, reason: 'no_such_day' }

    // `generateSlots` already removes booked and past times, so presence here means free.
    if (!day.some((slot) => slot.time === slotTime)) {
        const taken = toSlotMap(doctor.slots_booked)[slotDate] ?? []
        return {
            open: false,
            reason: taken.includes(slotTime) ? 'taken' : 'not_offered',
            remaining: day.slice(0, 5).map((s) => s.time),
        }
    }

    return { open: true, remaining: day.slice(0, 5).map((s) => s.time) }
}

// ─── Proposals ───────────────────────────────────────────────────────────────

export async function proposeBooking(args: ToolArgs): Promise<ToolOutcome> {
    const userId = await getSessionId('user')
    if (!userId) return bad('Not signed in.')

    const docId = str(args.doctorId)
    const slotDate = str(args.slotDate)
    const slotTime = str(args.slotTime)
    if (!docId || !slotDate || !slotTime) {
        return bad('A doctorId, slotDate and slotTime are all required.')
    }

    const doctor = await prisma.doctor.findUnique({
        where: { id: docId },
        select: {
            id: true,
            name: true,
            speciality: true,
            fees: true,
            available: true,
            profileCompleted: true,
            availableDays: true,
            slotStartTime: true,
            slotEndTime: true,
            slotDuration: true,
            slots_booked: true,
        },
    })
    if (!doctor || !doctor.profileCompleted) return bad('That doctor is not available.')
    if (!doctor.available) return bad('That doctor is not accepting bookings right now.')

    const check = slotIsOpen(doctor, slotDate, slotTime)
    if (!check.open) {
        return {
            ok: false,
            data: {
                error:
                    check.reason === 'taken'
                        ? 'That slot has already been booked.'
                        : 'That doctor does not have a slot at that time.',
                remainingTimes: check.remaining ?? [],
            },
        }
    }

    // Guard against booking the same doctor twice at the same time, which the UI makes
    // awkward but a conversation makes easy.
    const duplicate = await prisma.appointment.findFirst({
        where: { userId, docId, slotDate, slotTime, cancelled: false },
        select: { id: true },
    })
    if (duplicate) {
        return bad('You already have an appointment with this doctor at that time.')
    }

    const fee = doctor.fees ?? 0
    const when = formatSlotDateTime(slotDate, slotTime)

    const draft: PendingActionDraft = {
        action: 'book',
        params: { docId, slotDate, slotTime },
        summary: `Book ${doctor.name} on ${when}, consultation fee ₹${fee}.`,
    }

    return {
        ok: true,
        data: {
            proposed: true,
            doctor: doctor.name,
            speciality: doctor.speciality,
            when,
            fee,
            // Spelled out so the agent cannot imply the booking already happened.
            notYetBooked: true,
            instruction:
                'Read this back to the patient with the full weekday, date, time, timezone ' +
                'and fee, then wait for a clear yes before calling confirm_action.',
        },
        pendingAction: draft,
        uiPayload: {
            kind: 'confirm',
            action: 'book',
            titleKey: 'confirm_title_book',
            lines: [
                { labelKey: 'card_doctor', value: doctor.name },
                { labelKey: 'card_when', value: when },
                { labelKey: 'card_fee', value: `₹${fee}` },
            ],
        },
    }
}

export async function proposeCancellation(args: ToolArgs): Promise<ToolOutcome> {
    const userId = await getSessionId('user')
    if (!userId) return bad('Not signed in.')

    const appointmentId = str(args.appointmentId)
    if (!appointmentId) return bad('An appointmentId is required.')

    const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: {
            id: true,
            userId: true,
            slotDate: true,
            slotTime: true,
            amount: true,
            payment: true,
            cancelled: true,
            isCompleted: true,
            startTime: true,
            doctor: { select: { name: true } },
        },
    })
    // Ownership check before anything is revealed about the row.
    if (!appointment || appointment.userId !== userId) return bad('Appointment not found.')
    if (appointment.cancelled) return bad('That appointment is already cancelled.')
    if (appointment.isCompleted) return bad('That consultation is already complete.')
    if (appointmentStatus(appointment) !== 'Scheduled') {
        return bad('That appointment has already passed.')
    }

    const when = formatSlotDateTime(appointment.slotDate, appointment.slotTime)
    const doctorName = appointment.doctor?.name ?? 'your doctor'

    return {
        ok: true,
        data: {
            proposed: true,
            doctor: doctorName,
            when,
            // Surfaced because a paid appointment being cancelled is a different decision,
            // and MediCare has no automated refund path for the agent to promise.
            wasPaid: appointment.payment,
            refundNote: appointment.payment
                ? 'This appointment was paid online. MediCare has no automatic refund flow — ' +
                  'tell the patient to contact support about the fee, and do not promise a refund.'
                : null,
            notYetCancelled: true,
            instruction:
                'Read the doctor and the full date and time back, then wait for a clear yes ' +
                'before calling confirm_action.',
        },
        pendingAction: {
            action: 'cancel',
            params: { appointmentId },
            summary: `Cancel the appointment with ${doctorName} on ${when}.`,
        },
        uiPayload: {
            kind: 'confirm',
            action: 'cancel',
            titleKey: 'confirm_title_cancel',
            lines: [
                { labelKey: 'card_doctor', value: doctorName },
                { labelKey: 'card_when', value: when },
                ...(appointment.payment
                    ? [{ labelKey: 'card_paid', value: `₹${appointment.amount} — contact support about the fee` }]
                    : []),
            ],
        },
    }
}

export async function proposeReschedule(args: ToolArgs): Promise<ToolOutcome> {
    const userId = await getSessionId('user')
    if (!userId) return bad('Not signed in.')

    const appointmentId = str(args.appointmentId)
    const slotDate = str(args.slotDate)
    const slotTime = str(args.slotTime)
    if (!appointmentId || !slotDate || !slotTime) {
        return bad('An appointmentId, slotDate and slotTime are all required.')
    }

    const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: {
            id: true,
            userId: true,
            docId: true,
            slotDate: true,
            slotTime: true,
            cancelled: true,
            isCompleted: true,
            startTime: true,
            doctor: {
                select: {
                    name: true,
                    available: true,
                    availableDays: true,
                    slotStartTime: true,
                    slotEndTime: true,
                    slotDuration: true,
                    slots_booked: true,
                },
            },
        },
    })
    if (!appointment || appointment.userId !== userId) return bad('Appointment not found.')
    if (appointment.cancelled) return bad('That appointment was cancelled.')
    if (appointment.isCompleted) return bad('That consultation is already complete.')
    if (appointmentStatus(appointment) !== 'Scheduled') {
        return bad('That appointment has already passed. Book a new one instead.')
    }
    if (appointment.slotDate === slotDate && appointment.slotTime === slotTime) {
        return bad('That is already the time of this appointment.')
    }
    if (!appointment.doctor?.available) {
        return bad('That doctor is not accepting bookings right now.')
    }

    const check = slotIsOpen(appointment.doctor, slotDate, slotTime)
    if (!check.open) {
        return {
            ok: false,
            data: {
                error:
                    check.reason === 'taken'
                        ? 'That slot has already been booked.'
                        : 'That doctor does not have a slot at that time.',
                remainingTimes: check.remaining ?? [],
            },
        }
    }

    const from = formatSlotDateTime(appointment.slotDate, appointment.slotTime)
    const to = formatSlotDateTime(slotDate, slotTime)
    const doctorName = appointment.doctor.name

    return {
        ok: true,
        data: {
            proposed: true,
            doctor: doctorName,
            from,
            to,
            notYetRescheduled: true,
            instruction:
                'Read back both the old and the new date and time in full, with the timezone, ' +
                'then wait for a clear yes before calling confirm_action.',
        },
        pendingAction: {
            action: 'reschedule',
            params: { appointmentId, slotDate, slotTime },
            summary: `Move the appointment with ${doctorName} from ${from} to ${to}.`,
        },
        uiPayload: {
            kind: 'confirm',
            action: 'reschedule',
            titleKey: 'confirm_title_reschedule',
            lines: [
                { labelKey: 'card_doctor', value: doctorName },
                { labelKey: 'card_from', value: from },
                { labelKey: 'card_to', value: to },
            ],
        },
    }
}

// ─── Commits ─────────────────────────────────────────────────────────────────
//
// Reached only through the gateway, with parameters read from the pending-action store.
// These are not declared to the model, so there is no path by which it can call one
// directly with arguments of its own.

export async function executeBooking(params: Record<string, string>): Promise<ToolOutcome> {
    const result = await bookAppointment(params.docId, params.slotDate, params.slotTime)
    if (!result.success) {
        return {
            ok: false,
            data: {
                booked: false,
                error: result.message,
                // `bookAppointment` returns this exact wording when the slot went during
                // the conversation. Flagged so the agent says what happened rather than
                // reporting a generic failure — and never reports success.
                slotTaken: /just been taken/i.test(result.message),
            },
        }
    }
    return {
        ok: true,
        data: {
            booked: true,
            appointmentId: result.appointmentId,
            amount: result.amount,
            when: formatSlotDateTime(params.slotDate, params.slotTime),
            paymentNote:
                (result.amount ?? 0) > 0
                    ? 'Not paid yet. Offer to open the payment page; you cannot take payment by voice.'
                    : null,
        },
    }
}

export async function executeCancellation(
    params: Record<string, string>,
): Promise<ToolOutcome> {
    const result = await cancelAppointment(params.appointmentId)
    if (!result.success) return { ok: false, data: { cancelled: false, error: result.message } }
    return { ok: true, data: { cancelled: true } }
}

export async function executeReschedule(params: Record<string, string>): Promise<ToolOutcome> {
    const result = await rescheduleAppointment(
        params.appointmentId,
        params.slotDate,
        params.slotTime,
    )
    if (!result.success) {
        return {
            ok: false,
            data: {
                rescheduled: false,
                error: result.message,
                slotTaken: /just been taken/i.test(result.message),
                // The transaction leaves the original booking intact on failure, and the
                // agent must say so — otherwise the patient is left believing they now
                // have no appointment at all.
                originalIntact: true,
            },
        }
    }
    return {
        ok: true,
        data: {
            rescheduled: true,
            doctor: result.doctorName,
            when: formatSlotDateTime(result.slotDate, result.slotTime),
            previous: formatSlotDateTime(result.previous.slotDate, result.previous.slotTime),
        },
    }
}
