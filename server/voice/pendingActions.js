/**
 * Server-side pending-action state for consequential voice actions.
 *
 * The model never executes a booking, cancellation or reschedule. It *proposes* one; the
 * proposal is validated and priced by real backend data and recorded here; and only an
 * explicit confirmation from the patient commits it. On commit the parameters come from
 * **this store**, not from whatever the model passes to `confirm_action` — which is the
 * whole point. A confirmation that re-supplied its own arguments could drift from what the
 * patient actually agreed to, whether through a misheard correction, a model slip, or text
 * injected into a transcript.
 *
 * Why the server and not the client: a `confirmed: true` flag from the browser is
 * forgeable, and it also loses the binding between a confirmation and the exact parameters
 * that were confirmed.
 *
 * Scope limitation, stated plainly: this is per-process memory. It is correct for a single
 * container and for any deployment with sticky sessions, which is already required because
 * a voice session is a stateful socket. Across several instances without stickiness a
 * pending action would not be found on a different instance — the fix is the same Redis
 * adapter pattern `server.js` already uses for signaling rooms, and it is not built here
 * because nothing in this deployment needs it yet.
 */

const crypto = require('crypto')

/** How long a patient has to confirm before the proposal goes stale. */
const PENDING_TTL_MS = 3 * 60 * 1000

/**
 * How long a completed action's result is remembered for idempotency.
 *
 * Long enough to cover a reconnect and the patient asking again; short enough that a
 * genuinely new booking of the same slot later is not mistaken for a replay.
 */
const RESULT_TTL_MS = 30 * 60 * 1000

const SWEEP_INTERVAL_MS = 60 * 1000

/**
 * Canonical JSON: keys sorted, so `{a:1,b:2}` and `{b:2,a:1}` hash identically.
 *
 * Without this the binding hash would depend on key order, and a proposal confirmed
 * moments later could fail for no reason the patient could possibly understand.
 */
function canonical(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
    const keys = Object.keys(value).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
}

function fingerprint(action, params) {
    return crypto.createHash('sha256').update(`${action}|${canonical(params)}`).digest('hex')
}

class PendingActionStore {
    constructor() {
        /** key `${userId}:${sessionId}` → pending record. One per session, deliberately. */
        this.pending = new Map()
        /** idempotencyKey → { result, at } for completed mutations. */
        this.results = new Map()

        this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS)
        // Never hold the process open on account of a cache.
        if (this.sweeper.unref) this.sweeper.unref()
    }

    key(userId, sessionId) {
        return `${userId}:${sessionId}`
    }

    /**
     * Records a proposal, replacing any previous one for this session.
     *
     * Replacing rather than queueing is intentional: if the patient changes the doctor or
     * the time mid-conversation, the earlier proposal is no longer what they want, and
     * leaving it confirmable is how the wrong appointment gets booked.
     */
    propose(userId, sessionId, { action, params, summary, idempotencyKey }) {
        const record = {
            action,
            params,
            summary,
            idempotencyKey: idempotencyKey || crypto.randomUUID(),
            fingerprint: fingerprint(action, params),
            createdAt: Date.now(),
            expiresAt: Date.now() + PENDING_TTL_MS,
        }
        this.pending.set(this.key(userId, sessionId), record)
        return record
    }

    /**
     * Reads the pending action without touching it.
     *
     * Non-destructive deliberately. An earlier version deleted expired records here, which
     * made the *reason* a later `claim` could give depend on whether anything had peeked
     * first — so a genuinely expired proposal was sometimes reported as "nothing pending".
     * Those produce different spoken explanations, and "that proposal expired, let me set
     * it up again" is far more useful to a patient than "there is nothing to confirm".
     * Cleanup is the sweeper's job.
     */
    peek(userId, sessionId) {
        const record = this.pending.get(this.key(userId, sessionId))
        if (!record) return null
        return Date.now() > record.expiresAt ? null : record
    }

    /**
     * Claims the pending action for execution.
     *
     * Returns a reason instead of a record when it cannot be claimed, so the caller can
     * say something true and specific rather than a generic failure. Removing it on claim
     * means a repeated `confirm_action` cannot double-execute — the second call finds
     * nothing pending and is told so.
     */
    claim(userId, sessionId, expected) {
        const mapKey = this.key(userId, sessionId)
        const record = this.pending.get(mapKey)

        if (!record) return { ok: false, reason: 'none' }
        if (Date.now() > record.expiresAt) {
            this.pending.delete(mapKey)
            return { ok: false, reason: 'expired' }
        }

        // When the model names the action it thinks it is confirming, hold it to that.
        // A mismatch means the conversation and the stored proposal have diverged, and
        // guessing which one the patient meant is exactly what must not happen.
        if (expected && expected.action && expected.action !== record.action) {
            return { ok: false, reason: 'mismatch', record }
        }
        if (expected && expected.fingerprint && expected.fingerprint !== record.fingerprint) {
            return { ok: false, reason: 'mismatch', record }
        }

        this.pending.delete(mapKey)
        return { ok: true, record }
    }

    /** Drops a pending proposal — the patient said no, or changed the subject. */
    invalidate(userId, sessionId) {
        return this.pending.delete(this.key(userId, sessionId))
    }

    /** Previously recorded outcome for an idempotency key, if any. */
    resultFor(idempotencyKey) {
        const entry = this.results.get(idempotencyKey)
        if (!entry) return null
        if (Date.now() - entry.at > RESULT_TTL_MS) {
            this.results.delete(idempotencyKey)
            return null
        }
        return entry.result
    }

    /**
     * Records a completed mutation's outcome.
     *
     * `state` matters as much as the payload. A mutation whose outcome is genuinely
     * unknown — the transport died mid-commit — is stored as `unknown`, and the caller is
     * then required to read status before ever writing again. Retrying a write whose
     * result you cannot see is how one booking becomes two.
     */
    recordResult(idempotencyKey, result) {
        if (!idempotencyKey) return
        this.results.set(idempotencyKey, { result, at: Date.now() })
    }

    /** Clears everything for one session — called when the socket closes. */
    clearSession(userId, sessionId) {
        this.pending.delete(this.key(userId, sessionId))
    }

    sweep() {
        const now = Date.now()
        for (const [key, record] of this.pending) {
            if (now > record.expiresAt) this.pending.delete(key)
        }
        for (const [key, entry] of this.results) {
            if (now - entry.at > RESULT_TTL_MS) this.results.delete(key)
        }
    }
}

module.exports = {
    PendingActionStore,
    PENDING_TTL_MS,
    RESULT_TTL_MS,
    fingerprint,
    canonical,
}
