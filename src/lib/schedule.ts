/**
 * Appointment slot generation.
 *
 * Slots come from the consulting hours a doctor sets during onboarding: which weekdays
 * they see patients, the window they work, and how long one consultation runs.
 */

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export const DEFAULT_AVAILABLE_DAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
export const DEFAULT_SLOT_START = '10:00'
export const DEFAULT_SLOT_END = '17:00'
export const DEFAULT_SLOT_DURATION = 30

/** How many days ahead of today the booking calendar runs. */
export const BOOKING_WINDOW_DAYS = 7

export type Slot = {
    datetime: Date
    time: string
}

export type DoctorSchedule = {
    availableDays?: unknown
    slotStartTime?: string | null
    slotEndTime?: string | null
    slotDuration?: number | null
    slots_booked?: unknown
}

/**
 * Always formats as `hh:mm AM/PM` in en-US.
 *
 * The locale must be pinned: booked slots are stored as this exact string and compared
 * back as a string, so a browser on a 24-hour locale would write "14:30" where another
 * writes "02:30 PM" and neither would recognise the other's booking. The same format is
 * what the AI appointment context parses back out.
 */
export function formatSlotTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

/** Slot dates are keyed as `d_m_yyyy` in `Doctor.slots_booked`. */
export function formatSlotDateKey(date: Date): string {
    return `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`
}

/** Parses `"HH:MM"` into minutes past midnight, or null when malformed. */
function parseClock(value: string | null | undefined, fallback: string): number {
    const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? '').trim() || fallback)
    if (!match) return parseClock(null, fallback)
    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (hours > 23 || minutes > 59) return parseClock(null, fallback)
    return hours * 60 + minutes
}

export function parseAvailableDays(value: unknown): Weekday[] {
    if (!Array.isArray(value)) return DEFAULT_AVAILABLE_DAYS
    const days = value.filter((d): d is Weekday => WEEKDAYS.includes(d as Weekday))
    return days.length > 0 ? days : DEFAULT_AVAILABLE_DAYS
}

function bookedTimesFor(slotsBooked: unknown, dateKey: string): string[] {
    if (!slotsBooked || typeof slotsBooked !== 'object') return []
    const value = (slotsBooked as Record<string, unknown>)[dateKey]
    return Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string') : []
}

/**
 * Builds the next `BOOKING_WINDOW_DAYS` days of slots for a doctor.
 *
 * Days the doctor does not consult on, and days whose window has already passed, come
 * back as empty arrays so the calendar can still show (and disable) them — callers must
 * therefore handle empty days rather than assuming `slots[0]` exists.
 */
export function generateSlots(doctor: DoctorSchedule, now: Date = new Date()): Slot[][] {
    const availableDays = parseAvailableDays(doctor.availableDays)
    const startMinutes = parseClock(doctor.slotStartTime, DEFAULT_SLOT_START)
    const endMinutes = parseClock(doctor.slotEndTime, DEFAULT_SLOT_END)
    const duration =
        Number.isFinite(doctor.slotDuration) && (doctor.slotDuration as number) > 0
            ? (doctor.slotDuration as number)
            : DEFAULT_SLOT_DURATION

    const days: Slot[][] = []

    for (let dayOffset = 0; dayOffset < BOOKING_WINDOW_DAYS; dayOffset++) {
        const day = new Date(now)
        day.setDate(now.getDate() + dayOffset)
        day.setHours(0, 0, 0, 0)

        if (!availableDays.includes(WEEKDAYS[day.getDay()])) {
            days.push([])
            continue
        }

        const dateKey = formatSlotDateKey(day)
        const booked = bookedTimesFor(doctor.slots_booked, dateKey)
        const slots: Slot[] = []

        for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += duration) {
            const slotStart = new Date(day)
            slotStart.setMinutes(minutes)

            // Skip anything already in the past today.
            if (slotStart.getTime() <= now.getTime()) continue

            const time = formatSlotTime(slotStart)
            if (booked.includes(time)) continue

            slots.push({ datetime: slotStart, time })
        }

        days.push(slots)
    }

    return days
}

/**
 * `Doctor.slots_booked` is stored as `{ "12_8_2026": ["10:00 AM", "10:30 AM"] }`.
 * Prisma hands it back as loose `JsonValue`, so normalise before reading or writing it.
 */
export type SlotMap = Record<string, string[]>

export function toSlotMap(value: unknown): SlotMap {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const map: SlotMap = {}
    for (const [key, times] of Object.entries(value as Record<string, unknown>)) {
        if (Array.isArray(times)) {
            map[key] = times.filter((time): time is string => typeof time === 'string')
        }
    }
    return map
}
