import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export type SessionRole = 'user' | 'doctor' | 'admin'

export const USER_COOKIE = 'token'
export const DOCTOR_COOKIE = 'docToken'
export const ADMIN_COOKIE = 'adminToken'

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

function jwtSecret(): string {
    const secret = process.env.JWT_SECRET
    if (!secret) {
        // Failing loudly beats signing with `undefined`, which throws deep inside
        // jsonwebtoken with a message that says nothing about the missing env var.
        throw new Error('JWT_SECRET is not set. Add it to your .env before starting the server.')
    }
    return secret
}

/**
 * `secure` must NOT be hard-coded to true: a Secure cookie is dropped outright by the
 * browser on any plain-HTTP origin (a LAN IP, a preview box, Safari on http://localhost).
 * When that happens login appears to succeed — the client stores its copy of the token —
 * but every server action then reads an empty cookie jar and answers "Not authorized",
 * which is what made freshly booked appointments never reach the doctor's dashboard.
 */
function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
    }
}

function cookieNameFor(role: SessionRole): string {
    if (role === 'user') return USER_COOKIE
    if (role === 'doctor') return DOCTOR_COOKIE
    return ADMIN_COOKIE
}

/** Signs a session token for `id` and writes it to the cookie for that role. */
export async function createSession(role: SessionRole, id: string): Promise<string> {
    const token = jwt.sign({ id, role }, jwtSecret(), { expiresIn: SESSION_MAX_AGE_SECONDS })
    const cookieStore = await cookies()
    cookieStore.set(cookieNameFor(role), token, cookieOptions())
    return token
}

export async function destroySession(role: SessionRole): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.delete(cookieNameFor(role))
}

/**
 * Returns the id of the signed-in principal for `role`, or null.
 *
 * The `role` claim is checked as well as the signature. Every cookie is signed with the
 * same secret, so without it a patient's token pasted into `docToken` would verify
 * happily and be treated as a doctor id. Tokens issued before the claim existed have no
 * `role` and are rejected, which just sends that person back through login.
 */
export async function getSessionId(role: SessionRole): Promise<string | null> {
    const cookieStore = await cookies()
    const token = cookieStore.get(cookieNameFor(role))?.value
    if (!token) return null

    try {
        const decoded = jwt.verify(token, jwtSecret()) as { id?: string; role?: SessionRole }
        if (decoded.role !== role || !decoded.id) return null
        return decoded.id
    } catch {
        return null
    }
}
