/**
 * Cookie and JWT verification for the Node layer.
 *
 * Mirrors `src/lib/auth.ts` — keep these in step with it. This duplication is deliberate
 * and pre-existing: `server.js` boots before Next's build pipeline and cannot import the
 * app's TypeScript modules, so the small amount of session logic the raw server needs is
 * reimplemented here against the same cookie names and the same JWT claims.
 *
 * Previously `server.js` carried its own private copy of these two functions. The voice
 * gateway needs exactly the same checks, so they live here now and both require them —
 * one mirror of `lib/auth.ts` rather than two.
 */

const jwt = require('jsonwebtoken')

const USER_COOKIE = 'token'
const DOCTOR_COOKIE = 'docToken'
const ADMIN_COOKIE = 'adminToken'

/** Minimal cookie-header parser; a handshake gives us a raw header, not a cookie jar. */
function parseCookies(header) {
    const jar = {}
    for (const part of (header || '').split(';')) {
        const index = part.indexOf('=')
        if (index === -1) continue
        jar[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
    }
    return jar
}

/**
 * Verifies one role's cookie and returns its subject id, or null.
 *
 * The `role` claim is checked as well as the signature: every cookie is signed with the
 * same secret, so without it a patient token pasted into `docToken` would pass.
 */
function sessionId(jar, cookieName, role) {
    const token = jar[cookieName]
    if (!token) return null
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        return decoded && decoded.role === role && decoded.id ? decoded.id : null
    } catch {
        return null
    }
}

module.exports = {
    USER_COOKIE,
    DOCTOR_COOKIE,
    ADMIN_COOKIE,
    parseCookies,
    sessionId,
}
