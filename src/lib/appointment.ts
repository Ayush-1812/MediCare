import { DEFAULT_SLOT_DURATION } from './schedule'

/**
 * Appointment status, derived rather than stored.
 *
 * `Appointment` only records `cancelled` and `isCompleted`, so an appointment whose time
 * came and went without the doctor marking it complete used to keep rendering as an
 * upcoming booking (and the doctor's "Completed" badge was the only terminal state a
 * patient ever saw). Anything past its slot that was never completed is a no-show.
 */
export type AppointmentStatus = 'Cancelled' | 'Completed' | 'Missed' | 'Scheduled'

export type StatusableAppointment = {
    slotDate?: string | null
    slotTime?: string | null
    cancelled?: boolean | null
    isCompleted?: boolean | null
    /** Set the moment the doctor opens the consultation room. */
    startTime?: Date | string | null
}

/**
 * Parses the stored `slotDate` (`"d_m_yyyy"`) and `slotTime` (`"hh:mm AM/PM"`) pair back
 * into a Date. Returns null if either is missing or malformed, so callers can fall back
 * to "Scheduled" instead of mislabelling an appointment as missed.
 */
export function parseSlotDateTime(
    slotDate?: string | null,
    slotTime?: string | null,
): Date | null {
    if (!slotDate) return null

    const dateParts = slotDate.split('_').map(Number)
    if (dateParts.length !== 3 || dateParts.some((n) => !Number.isFinite(n))) return null
    const [day, month, year] = dateParts

    let hours = 0
    let minutes = 0
    const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((slotTime ?? '').trim())
    if (match) {
        hours = Number(match[1]) % 12
        minutes = Number(match[2])
        if (match[3].toUpperCase() === 'PM') hours += 12
    }

    const date = new Date(year, month - 1, day, hours, minutes)
    return Number.isNaN(date.getTime()) ? null : date
}

/**
 * An appointment is only "missed" once its slot has fully elapsed — a consultation that
 * started five minutes ago is still in progress, not missed.
 */
const GRACE_MINUTES = DEFAULT_SLOT_DURATION

export function appointmentStatus(
    appointment: StatusableAppointment,
    now: Date = new Date(),
): AppointmentStatus {
    if (appointment.cancelled) return 'Cancelled'
    if (appointment.isCompleted) return 'Completed'

    const slot = parseSlotDateTime(appointment.slotDate, appointment.slotTime)
    if (!slot) return 'Scheduled'

    let elapsedAt = slot.getTime() + GRACE_MINUTES * 60 * 1000

    // A consultation that actually started keeps its grace period running from the moment
    // the room opened. Without this, a call that begins late or overruns its slot flips to
    // "Missed" while the two of them are still talking — and the patient who steps out for
    // a second then finds no way back in.
    if (appointment.startTime) {
        const startedAt = new Date(appointment.startTime).getTime()
        if (!Number.isNaN(startedAt)) {
            elapsedAt = Math.max(elapsedAt, startedAt + GRACE_MINUTES * 60 * 1000)
        }
    }

    return now.getTime() > elapsedAt ? 'Missed' : 'Scheduled'
}

/** True while the appointment can still be joined, cancelled or completed. */
export function isActionable(appointment: StatusableAppointment, now: Date = new Date()): boolean {
    return appointmentStatus(appointment, now) === 'Scheduled'
}

/** Tailwind classes for each status badge, so every screen labels them identically. */
export const STATUS_STYLES: Record<AppointmentStatus, string> = {
    Cancelled: 'text-red-600 bg-red-50 border-red-200',
    Completed: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    Missed: 'text-amber-600 bg-amber-50 border-amber-200',
    Scheduled: 'text-blue-600 bg-blue-50 border-blue-200',
}

/** `"20_8_2026"` -> `"20 August 2026"`. Falls back to the raw value if unparseable. */
export function formatSlotDate(slotDate?: string | null): string {
    const parsed = parseSlotDateTime(slotDate, null)
    if (!parsed) return slotDate ?? ''
    return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * How long before the slot the consultation room opens.
 *
 * The room is not available all week: showing "Join video call" next to an appointment
 * three days out sends patients into an empty waiting room, and hiding the button until
 * the doctor happens to press Start (the old behaviour) left patients with no entry point
 * at all. Opening it a quarter of an hour early covers both.
 */
export const JOIN_WINDOW_MINUTES = 15

export type JoinState = {
    /** True while the room can be entered right now. */
    canJoin: boolean
    /** True once the appointment is over/cancelled — the button should disappear entirely. */
    closed: boolean
    /** Short explanation for the disabled state, e.g. "Opens 15 min before your slot". */
    reason?: string
}

/**
 * Whether the patient may enter the consultation room for `appointment` yet.
 *
 * Mirrors `appointmentStatus`: only a Scheduled appointment is joinable, and only inside
 * the window that runs from `JOIN_WINDOW_MINUTES` before the slot to the end of the grace
 * period the status helper already uses.
 */
export function consultationJoinState(
    appointment: StatusableAppointment & { meetingId?: string | null },
    now: Date = new Date(),
): JoinState {
    const status = appointmentStatus(appointment, now)
    if (status !== 'Scheduled') return { canJoin: false, closed: true, reason: status }

    // Once the doctor has opened the room the window no longer applies — a doctor running
    // ahead of schedule should not be left waiting on the clock.
    if (appointment.meetingId) return { canJoin: true, closed: false }

    const slot = parseSlotDateTime(appointment.slotDate, appointment.slotTime)
    // An unparseable slot must not lock anyone out of a booking that is otherwise live.
    if (!slot) return { canJoin: true, closed: false }

    const opensAt = slot.getTime() - JOIN_WINDOW_MINUTES * 60 * 1000
    if (now.getTime() < opensAt) {
        return {
            canJoin: false,
            closed: false,
            reason: `Opens ${JOIN_WINDOW_MINUTES} min before your slot`,
        }
    }

    return { canJoin: true, closed: false }
}

/** `"20_8_2026"` + `"04:30 PM"` -> `"20 August 2026 at 04:30 PM"`. */
export function formatSlotDateTime(slotDate?: string | null, slotTime?: string | null): string {
    const date = formatSlotDate(slotDate)
    if (!slotTime) return date
    return date ? `${date} at ${slotTime}` : slotTime
}
