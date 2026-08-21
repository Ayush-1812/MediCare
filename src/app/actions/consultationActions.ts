'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getSessionId } from '@/lib/auth'

/**
 * Server actions behind the video consultation room.
 *
 * Sessions are read through `getSessionId`, which verifies the signature *and* the `role`
 * claim. The earlier version decoded `docToken` by hand and — worse — `getConsultationDetails`
 * did no authorization at all, so anyone holding an appointment id could read another
 * patient's diagnosis, private notes and meeting room name.
 */

function fail(message: string) {
    return { success: false as const, message }
}

function unexpected(scope: string, error: unknown) {
    console.error(`[${scope}]`, error)
    return fail('Something went wrong. Please try again.')
}

export type ConsultationRole = 'doctor' | 'patient'

/** Everything the consultation room needs off an appointment row. */
function findAppointment(appointmentId: string) {
    return prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: {
            id: true,
            docId: true,
            userId: true,
            slotDate: true,
            slotTime: true,
            userData: true,
            docData: true,
            meetingId: true,
            cancelled: true,
            isCompleted: true,
            startTime: true,
            endTime: true,
            duration: true,
            diagnosis: true,
            prescription: true,
            notes: true,
            followUpDate: true,
        },
    })
}

type ConsultationRow = NonNullable<Awaited<ReturnType<typeof findAppointment>>>

type AuthResult =
    | { ok: false; message: string }
    | { ok: true; appointment: ConsultationRow; role: ConsultationRole }

/** Resolves who is calling, and whether they are actually party to this appointment. */
async function authorize(appointmentId: string): Promise<AuthResult> {
    const doctorId = await getSessionId('doctor')
    const userId = await getSessionId('user')
    if (!doctorId && !userId) return { ok: false, message: 'Please sign in to join this consultation.' }

    const appointment = await findAppointment(appointmentId)
    if (!appointment) return { ok: false, message: 'Appointment not found' }

    const isDoctor = Boolean(doctorId) && appointment.docId === doctorId
    const isPatient = Boolean(userId) && appointment.userId === userId
    if (!isDoctor && !isPatient) return { ok: false, message: 'You are not part of this consultation.' }

    return { ok: true, appointment, role: isDoctor ? 'doctor' : 'patient' }
}

export async function startConsultation(appointmentId: string) {
    try {
        const auth = await authorize(appointmentId)
        if (!auth.ok) return fail(auth.message)
        // Only the doctor opens the room; the patient waits for them to admit her.
        if (auth.role !== 'doctor') return fail('Only the doctor can start the consultation.')

        const { appointment } = auth
        if (appointment.cancelled) return fail('This appointment was cancelled.')
        if (appointment.isCompleted) return fail('This consultation has already been completed.')

        // A meeting id must be issued even when `startTime` is already set: the previous
        // version returned early on `startTime` alone, so an appointment whose room name
        // was somehow missing could never get one and both sides sat in the waiting room.
        const meetingId =
            appointment.meetingId ??
            `medicare-${appointmentId}-${Math.random().toString(36).slice(2, 10)}`

        await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                startTime: appointment.startTime ?? new Date(),
                meetingId,
            },
        })

        revalidatePath(`/video-call/${appointmentId}`)
        return { success: true as const, message: 'Consultation started', meetingId }
    } catch (error) {
        return unexpected('startConsultation', error)
    }
}

export async function endConsultation(
    appointmentId: string,
    data: {
        diagnosis: string
        prescription: string
        notes: string
        followUpDate?: string
    },
) {
    try {
        const auth = await authorize(appointmentId)
        if (!auth.ok) return fail(auth.message)
        if (auth.role !== 'doctor') return fail('Only the doctor can end the consultation.')

        const { appointment } = auth
        const endTime = new Date()
        const startTime = appointment.startTime ?? endTime
        const duration = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000))

        const followUpDate = data.followUpDate ? new Date(data.followUpDate) : null
        if (followUpDate && Number.isNaN(followUpDate.getTime())) {
            return fail('That follow-up date is not valid.')
        }

        await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                startTime,
                endTime,
                duration,
                diagnosis: data.diagnosis,
                prescription: data.prescription,
                notes: data.notes,
                followUpDate,
                isCompleted: true,
            },
        })

        revalidatePath(`/video-call/${appointmentId}`)
        revalidatePath('/my-appointments')
        revalidatePath('/doctor-dashboard/appointments')
        return { success: true as const, message: 'Consultation ended and saved' }
    } catch (error) {
        return unexpected('endConsultation', error)
    }
}

export async function getConsultationDetails(appointmentId: string) {
    try {
        const auth = await authorize(appointmentId)
        if (!auth.ok) return fail(auth.message)

        const { appointment, role } = auth
        const patientName = (appointment.userData as { name?: string } | null)?.name ?? ''
        const doctorName = (appointment.docData as { name?: string } | null)?.name ?? ''

        return {
            success: true as const,
            role,
            appointment: {
                id: appointment.id,
                slotDate: appointment.slotDate,
                slotTime: appointment.slotTime,
                patientName,
                doctorName,
                /** Display name for the person on this side of the call. */
                displayName: role === 'doctor' ? doctorName || 'Doctor' : patientName || 'Patient',
                meetingId: appointment.meetingId,
                cancelled: appointment.cancelled,
                isCompleted: appointment.isCompleted,
                startTime: appointment.startTime?.toISOString() ?? null,
                endTime: appointment.endTime?.toISOString() ?? null,
                duration: appointment.duration,
                diagnosis: appointment.diagnosis,
                prescription: appointment.prescription,
                // `notes` are the doctor's private notes. The summary screen only *hid* them
                // from patients in the markup; they were still shipped to the browser.
                notes: role === 'doctor' ? appointment.notes : null,
                followUpDate: appointment.followUpDate?.toISOString() ?? null,
            },
        }
    } catch (error) {
        return unexpected('getConsultationDetails', error)
    }
}
