/**
 * One vocabulary for the patient profile fields.
 *
 * Gender had two different "unset" sentinels: the sign-up form stored `"Not Specified"`
 * while the profile page's <select> only offered `"Not Selected"`. A value with no
 * matching <option> makes the browser display the *first* option instead ("Male"), and
 * re-picking that option fires no change event — so editing gender silently saved the
 * old value back. Everything now normalises through here.
 */

export const GENDER_UNSET = 'Not Selected'
export const GENDER_CHOICES = ['Male', 'Female', 'Other'] as const
export type Gender = (typeof GENDER_CHOICES)[number] | typeof GENDER_UNSET

/** Anything unrecognised — including the legacy `"Not Specified"` — becomes the sentinel. */
export function normalizeGender(value?: string | null): Gender {
    const candidate = (value ?? '').trim()
    const match = GENDER_CHOICES.find((g) => g.toLowerCase() === candidate.toLowerCase())
    return match ?? GENDER_UNSET
}

export function isGenderSet(value?: string | null): boolean {
    return normalizeGender(value) !== GENDER_UNSET
}

// ─── Date of birth ───────────────────────────────────────────────────────────

/** `dob` is a free-text column whose default is the literal string "Not Selected". */
export const DOB_UNSET = 'Not Selected'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isDobSet(value?: string | null): boolean {
    const dob = (value ?? '').trim()
    return ISO_DATE.test(dob) && !Number.isNaN(new Date(dob).getTime())
}

/** Safe `value` for `<input type="date">` — anything unparseable becomes empty. */
export function dobInputValue(value?: string | null): string {
    return isDobSet(value) ? (value as string).trim() : ''
}

/** `"1995-04-12"` -> `"12 April 1995"`. */
export function formatDob(value?: string | null): string {
    if (!isDobSet(value)) return 'Not provided'
    return new Date((value as string).trim()).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    })
}

// ─── Phone ───────────────────────────────────────────────────────────────────

/** The column default, which is a placeholder rather than a real number. */
export const PHONE_UNSET = '0000000000'

export function isPhoneSet(value?: string | null): boolean {
    const phone = (value ?? '').trim()
    return phone.length > 0 && phone !== PHONE_UNSET
}

export function formatPhone(value?: string | null): string {
    return isPhoneSet(value) ? (value as string).trim() : 'Not provided'
}

/** Digits, spaces, +, - and brackets; 7-15 digits once stripped. */
export function isValidPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '')
    return digits.length >= 7 && digits.length <= 15
}

// ─── Address ─────────────────────────────────────────────────────────────────

export type Address = { line1: string; line2: string }

export function toAddress(value: unknown): Address {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { line1: '', line2: '' }
    const record = value as Record<string, unknown>
    return {
        line1: typeof record.line1 === 'string' ? record.line1 : '',
        line2: typeof record.line2 === 'string' ? record.line2 : '',
    }
}

export function isAddressSet(value: unknown): boolean {
    const address = toAddress(value)
    return address.line1.trim().length > 0 || address.line2.trim().length > 0
}

export function formatAddress(value: unknown): string {
    const address = toAddress(value)
    const parts = [address.line1.trim(), address.line2.trim()].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : 'Not provided'
}

// ─── Completeness ────────────────────────────────────────────────────────────

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

export type ProfileDetails = {
    gender?: string | null
    dob?: string | null
    phone?: string | null
    address?: unknown
    heightCm?: number | null
    weightKg?: number | null
    bloodGroup?: string | null
    allergies?: string | null
}

/**
 * Which details the patient has filled in. Drives whether the dashboard shows the
 * "Complete your profile" prompt or the real values — nothing is ever shown as a
 * placeholder number.
 */
export function profileCompleteness(profile: ProfileDetails) {
    const filled = {
        gender: isGenderSet(profile.gender),
        dob: isDobSet(profile.dob),
        phone: isPhoneSet(profile.phone),
        address: isAddressSet(profile.address),
        height: profile.heightCm != null,
        weight: profile.weightKg != null,
        bloodGroup: Boolean(profile.bloodGroup),
        // Allergies are deliberately excluded from the count: "none" is a valid answer
        // that leaves the field empty, so requiring it would never let anyone finish.
    }

    const values = Object.values(filled)
    const done = values.filter(Boolean).length
    return {
        filled,
        done,
        total: values.length,
        percent: Math.round((done / values.length) * 100),
        isComplete: done === values.length,
        hasAny: done > 0,
    }
}
