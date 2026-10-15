/**
 * Tool execution for the voice receptionist.
 *
 * Runs inside Next — never in `server.js` — for two reasons. The gateway is CommonJS and
 * cannot import the app's TypeScript, and more fundamentally every server action resolves
 * identity through `getSessionId`, which calls `cookies()` from `next/headers` and so
 * requires a Next request scope. Reimplementing any of this in the bare Node server would
 * create a second source of truth for booking and availability, which is exactly what the
 * Phase 1 audit ruled out.
 *
 * Results are shaped for speech, not for a screen. A tool that returns forty appointments
 * produces an answer nobody can listen to, so list tools return a count plus the few rows
 * that matter and say how many were left out.
 */

import prisma from '@/lib/prisma'
import { getProfile, listAppointments } from '@/app/actions/userActions'
import { getPrescriptions } from '@/app/actions/prescriptionActions'
import { getConsultationDetails } from '@/app/actions/consultationActions'
import { HealthSummaryTool } from '@/lib/ai/tools/PatientDataTools'
import { SymptomAssessmentTool } from '@/lib/ai/tools/SymptomAssessmentTool'
import { generateSlots, formatSlotDateKey, type Slot } from '@/lib/schedule'
import {
    appointmentStatus,
    consultationJoinState,
    formatSlotDateTime,
    parseSlotDateTime,
} from '@/lib/appointment'
import { MUTATING_TOOLS } from './definitions'

export type ToolArgs = Record<string, unknown>

export type ToolOutcome = {
    /** False only for a genuine failure — "nothing found" is a successful empty result. */
    ok: boolean
    /** Shown to the model. Keep keys short; every token here is prompt budget. */
    data: unknown
    /** Client-side side effect, currently only navigation. */
    clientAction?: { kind: 'navigate'; path: string; reason?: string }
}

// ─── Argument coercion ───────────────────────────────────────────────────────
//
// The model supplies arguments as loose JSON and will occasionally send a number as a
// string or a single value where a list was described. Coercing here keeps every tool
// body free of defensive parsing.

function str(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}

function num(value: unknown): number | undefined {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

function limitOf(value: unknown, fallback: number, max = 5): number {
    const parsed = num(value) ?? fallback
    return Math.max(1, Math.min(max, Math.floor(parsed)))
}

// ─── Read tools ──────────────────────────────────────────────────────────────

async function toolGetMyProfile(): Promise<ToolOutcome> {
    const result = await getProfile()
    if (!result.success) return { ok: false, data: { error: result.message } }

    const u = result.userData
    const address = (u.address ?? {}) as { line1?: string; line2?: string }
    return {
        ok: true,
        data: {
            name: u.name,
            email: u.email,
            phone: u.phone === '0000000000' ? null : u.phone,
            gender: u.gender === 'Not Selected' ? null : u.gender,
            dateOfBirth: u.dob === 'Not Selected' ? null : u.dob,
            address: [address.line1, address.line2].filter(Boolean).join(', ') || null,
            heightCm: u.heightCm,
            weightKg: u.weightKg,
            bloodGroup: u.bloodGroup,
            // Free text, read back verbatim — never normalized into a drug name.
            allergies: u.allergies?.trim() || null,
        },
    }
}

async function toolListMyAppointments(args: ToolArgs): Promise<ToolOutcome> {
    const result = await listAppointments()
    if (!result.success) return { ok: false, data: { error: result.message } }

    const status = str(args.status) ?? 'upcoming'
    const limit = limitOf(args.limit, 3)
    const now = new Date()

    const enriched = result.appointments.map((a) => {
        const derived = appointmentStatus(a, now)
        const join = consultationJoinState(a, now)
        return {
            id: a.id,
            doctor: a.doctor?.name ?? 'Unknown doctor',
            speciality: a.doctor?.speciality ?? null,
            when: formatSlotDateTime(a.slotDate, a.slotTime),
            at: parseSlotDateTime(a.slotDate, a.slotTime),
            status: derived,
            fee: a.amount,
            paid: a.payment,
            // So the agent can say "you can join now" instead of guessing.
            canJoinNow: join.canJoin,
            joinNote: join.reason ?? null,
        }
    })

    const matches = enriched.filter((a) => {
        if (status === 'all') return true
        if (status === 'cancelled') return a.status === 'Cancelled'
        if (status === 'past') return a.status === 'Completed' || a.status === 'Missed'
        return a.status === 'Scheduled'
    })

    // Upcoming reads best soonest-first; history reads best most-recent-first.
    matches.sort((a, b) => {
        const ta = a.at?.getTime() ?? 0
        const tb = b.at?.getTime() ?? 0
        return status === 'upcoming' ? ta - tb : tb - ta
    })

    const shown = matches.slice(0, limit).map(({ at, ...rest }) => rest)
    return {
        ok: true,
        data: {
            filter: status,
            total: matches.length,
            notShown: Math.max(0, matches.length - shown.length),
            appointments: shown,
        },
    }
}

async function toolSearchDoctors(args: ToolArgs): Promise<ToolOutcome> {
    const limit = limitOf(args.limit, 3)
    const speciality = str(args.speciality)
    const city = str(args.city)
    const name = str(args.name)
    const language = str(args.language)
    const maxFee = num(args.maxFee)

    // `profileCompleted` and `available` mirror `doctorList` exactly: a doctor who never
    // finished onboarding has no fee or consulting hours and is not bookable, and the
    // agent must never offer one.
    const doctors = await prisma.doctor.findMany({
        where: {
            profileCompleted: true,
            available: true,
            ...(speciality ? { speciality: { contains: speciality, mode: 'insensitive' } } : {}),
            ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
            ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
            ...(language ? { languages: { contains: language, mode: 'insensitive' } } : {}),
            ...(maxFee !== undefined ? { fees: { lte: Math.ceil(maxFee) } } : {}),
        },
        select: {
            id: true,
            name: true,
            speciality: true,
            degree: true,
            experience: true,
            fees: true,
            city: true,
            hospital: true,
            languages: true,
            rating: true,
            totalReviews: true,
        },
        orderBy: [{ rating: 'desc' }, { name: 'asc' }],
        take: limit + 1,
    })

    const shown = doctors.slice(0, limit).map((d) => ({
        id: d.id,
        name: d.name,
        speciality: d.speciality,
        degree: d.degree,
        experience: d.experience,
        // Null fees must not be spoken as "free"; the UI shows nothing and so do we.
        fee: d.fees ?? null,
        city: d.city,
        hospital: d.hospital,
        languages: d.languages,
        rating: d.totalReviews > 0 ? d.rating : null,
        reviews: d.totalReviews || null,
    }))

    return {
        ok: true,
        data: {
            count: shown.length,
            moreAvailable: doctors.length > limit,
            doctors: shown,
            ...(shown.length === 0
                ? { note: 'No bookable doctor matched. Try a broader speciality or drop the city filter.' }
                : {}),
        },
    }
}

async function toolGetDoctorAvailability(args: ToolArgs): Promise<ToolOutcome> {
    const doctorId = str(args.doctorId)
    const doctorName = str(args.doctorName)
    if (!doctorId && !doctorName) {
        return { ok: false, data: { error: 'Provide doctorId or doctorName.' } }
    }

    const doctor = await prisma.doctor.findFirst({
        where: {
            profileCompleted: true,
            ...(doctorId
                ? { id: doctorId }
                : { name: { contains: doctorName as string, mode: 'insensitive' } }),
        },
        select: {
            id: true,
            name: true,
            speciality: true,
            fees: true,
            available: true,
            availableDays: true,
            slotStartTime: true,
            slotEndTime: true,
            slotDuration: true,
            slots_booked: true,
        },
    })
    if (!doctor) return { ok: true, data: { found: false, note: 'No such bookable doctor.' } }

    if (!doctor.available) {
        return {
            ok: true,
            data: {
                found: true,
                doctorId: doctor.id,
                doctor: doctor.name,
                acceptingBookings: false,
                note: 'This doctor is not accepting new bookings right now.',
            },
        }
    }

    // The same generator the booking page uses. Reusing it is the whole point: a second
    // implementation would eventually disagree about which slots are free.
    const days: Slot[][] = generateSlots(doctor)
    const onlyDate = str(args.date)

    const open = days
        .map((slots, index) => {
            const day = new Date()
            day.setDate(day.getDate() + index)
            day.setHours(0, 0, 0, 0)
            return { day, slots }
        })
        .filter(({ slots }) => slots.length > 0)
        .filter(({ day }) => {
            if (!onlyDate) return true
            const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(
                day.getDate(),
            ).padStart(2, '0')}`
            return iso === onlyDate
        })
        .map(({ day, slots }) => ({
            date: day.toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
            }),
            // The key booking writes against, so a later booking tool needs no re-derivation.
            slotDateKey: formatSlotDateKey(day),
            // Exact stored strings. Booking compares on these, so they must not be reformatted.
            times: slots.slice(0, 8).map((s) => s.time),
            totalOpen: slots.length,
        }))

    return {
        ok: true,
        data: {
            found: true,
            doctorId: doctor.id,
            doctor: doctor.name,
            speciality: doctor.speciality,
            fee: doctor.fees ?? null,
            acceptingBookings: true,
            openDays: open,
            ...(open.length === 0
                ? { note: 'No open slots in the next 7 days.' }
                : {}),
        },
    }
}

async function toolListMyPrescriptions(args: ToolArgs): Promise<ToolOutcome> {
    const result = await getPrescriptions()
    if (!result.success) return { ok: false, data: { error: result.message } }

    const limit = limitOf(args.limit, 2)
    const shown = result.prescriptions.slice(0, limit).map((p) => ({
        id: p.id,
        savedOn: p.createdAt.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }),
        // Dosages pass through untouched. Rounding or converting a dose is a patient-safety
        // problem, so nothing in this path reshapes them.
        medicines: p.medicines,
        notes: p.notes?.trim() || null,
        verified: p.isVerified,
    }))

    return {
        ok: true,
        data: {
            total: result.prescriptions.length,
            notShown: Math.max(0, result.prescriptions.length - shown.length),
            prescriptions: shown,
            readBackRule: 'Read medicine names and doses exactly as given. Never round or convert.',
        },
    }
}

async function toolGetHealthSummary(userId: string): Promise<ToolOutcome> {
    const result = await new HealthSummaryTool().execute(userId)
    return { ok: result.success, data: result.data }
}

async function toolAssessSymptoms(userId: string, args: ToolArgs): Promise<ToolOutcome> {
    const description = str(args.description)
    if (!description) return { ok: false, data: { error: 'A symptom description is required.' } }

    const result = await new SymptomAssessmentTool().execute(userId, { message: description })
    const data = (result.data ?? {}) as Record<string, unknown>

    // Hoisted to the top level so the instruction cannot be missed inside a nested object.
    const severity = (data.severity ?? (data.classification as Record<string, unknown>)?.severity) as
        | string
        | undefined

    return {
        ok: result.success,
        data: {
            ...data,
            ...(severity === 'EMERGENCY'
                ? {
                      MUST_DO:
                          'Stop all other tasks. Tell the patient clearly to seek emergency ' +
                          'care immediately. Do not continue booking or any other flow.',
                  }
                : {}),
        },
    }
}

async function toolGetConsultationSummary(args: ToolArgs): Promise<ToolOutcome> {
    const appointmentId = str(args.appointmentId)
    if (!appointmentId) return { ok: false, data: { error: 'appointmentId is required.' } }

    // This action authorizes internally and nulls the doctor's private notes for a
    // patient. We pass its result through rather than re-selecting the row, so that
    // redaction cannot be widened by accident here.
    const result = await getConsultationDetails(appointmentId)
    if (!result.success) return { ok: false, data: { error: result.message } }

    const a = result.appointment
    return {
        ok: true,
        data: {
            when: formatSlotDateTime(a.slotDate, a.slotTime),
            doctor: a.doctorName,
            completed: a.isCompleted,
            cancelled: a.cancelled,
            diagnosis: a.diagnosis,
            prescription: a.prescription,
            followUpDate: a.followUpDate,
            yourNotes: a.patientNotes,
            ...(a.diagnosis || a.prescription
                ? {}
                : { note: 'The doctor has not written up this consultation yet.' }),
        },
    }
}

// ─── Guided navigation ───────────────────────────────────────────────────────

const NAV_PATHS: Record<string, string | ((args: ToolArgs) => string | null)> = {
    doctors: '/doctors',
    my_appointments: '/my-appointments',
    my_profile: '/my-profile',
    prescriptions: '/my-profile/prescriptions',
    new_prescription: '/my-profile/prescriptions/new',
    pharmacies: '/pharmacies',
    ai_assistant: '/ai-assistant',
    login: '/login',
    contact: '/contact',
    doctor_profile: (args) => {
        const id = str(args.doctorId)
        return id ? `/appointment/${id}` : null
    },
    video_call: (args) => {
        const id = str(args.appointmentId)
        return id ? `/video-call/${id}` : null
    },
}

function toolNavigate(args: ToolArgs): ToolOutcome {
    const destination = str(args.destination)
    const entry = destination ? NAV_PATHS[destination] : undefined
    if (!entry) {
        return { ok: false, data: { error: `Unknown destination "${destination ?? ''}".` } }
    }

    const path = typeof entry === 'function' ? entry(args) : entry
    if (!path) {
        return {
            ok: false,
            data: { error: `Destination "${destination}" needs an id that was not supplied.` },
        }
    }

    return {
        ok: true,
        data: { navigatedTo: path },
        clientAction: { kind: 'navigate', path, reason: str(args.reason) },
    }
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

/**
 * Runs one tool call.
 *
 * `userId` is the authenticated patient, resolved by the caller from the session cookie —
 * it is never taken from the model's arguments. A tool that accepted an id from the model
 * would let a prompt-injected transcript read someone else's record.
 */
export async function executeVoiceTool(
    userId: string,
    name: string,
    args: ToolArgs,
): Promise<ToolOutcome> {
    switch (name) {
        case 'get_my_profile':
            return toolGetMyProfile()
        case 'list_my_appointments':
            return toolListMyAppointments(args)
        case 'search_doctors':
            return toolSearchDoctors(args)
        case 'get_doctor_availability':
            return toolGetDoctorAvailability(args)
        case 'list_my_prescriptions':
            return toolListMyPrescriptions(args)
        case 'get_health_summary':
            return toolGetHealthSummary(userId)
        case 'assess_symptoms':
            return toolAssessSymptoms(userId, args)
        case 'get_consultation_summary':
            return toolGetConsultationSummary(args)
        case 'navigate':
            return toolNavigate(args)
        default:
            return { ok: false, data: { error: `Unknown tool "${name}".` } }
    }
}

/** True when a tool's effects outlive the conversation and so must not be replayed. */
export function isMutating(name: string): boolean {
    return MUTATING_TOOLS.has(name)
}
