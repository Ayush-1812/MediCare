/**
 * Default avatars.
 *
 * Until a patient or doctor uploads their own photo we show a gender-appropriate
 * illustrated avatar instead of a single generic "boy" picture. Gender is stored as a
 * free-text field ("Male", "female", "Not Selected", …) on both User and Doctor, so the
 * match is deliberately loose and falls back to a neutral avatar when unknown.
 */

export const AVATAR_MALE = '/assets/avatar-male.svg'
export const AVATAR_FEMALE = '/assets/avatar-female.svg'
export const AVATAR_NEUTRAL = '/assets/avatar-neutral.svg'

export function defaultAvatar(gender?: string | null): string {
    const g = (gender ?? '').trim().toLowerCase()
    if (g === 'male' || g === 'm' || g === 'man') return AVATAR_MALE
    if (g === 'female' || g === 'f' || g === 'woman') return AVATAR_FEMALE
    return AVATAR_NEUTRAL
}

/**
 * Resolves the image to render for a person: their uploaded photo when there is one,
 * otherwise the default avatar for their gender. Blank strings count as "no photo" —
 * `registerDoctor` used to seed `image: ''`, and Cloudinary returns undefined on failure.
 */
export function avatarFor(image?: string | null, gender?: string | null): string {
    const src = (image ?? '').trim()
    return src.length > 0 ? src : defaultAvatar(gender)
}
