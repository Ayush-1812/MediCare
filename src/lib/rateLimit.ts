/**
 * A small fixed-window rate limiter for authentication endpoints.
 *
 * Login and registration previously accepted unlimited attempts. That allows password
 * guessing at whatever rate the network permits, and because each attempt runs bcrypt
 * (deliberately expensive) it doubles as a cheap way to exhaust the server's CPU.
 *
 * Deliberately in-process and dependency-free:
 *   - It works the moment it is imported, with nothing to provision.
 *   - Counters live in this Node process, so with several instances behind a load
 *     balancer each enforces its own share of the budget. For a single container that is
 *     exact; for a scaled deployment it is a ceiling per instance rather than globally.
 *     Moving to Redis later means swapping the map for a shared store — the call sites
 *     do not change. (`REDIS_URL` already exists for the Socket.IO adapter.)
 *   - It is not a defence against a large distributed attack. It stops the realistic
 *     case: one client hammering one account.
 */

type Bucket = { count: number; resetAt: number }

// Held on globalThis so Next's dev-mode module reloading does not silently reset every
// counter on each edit — the same reason `src/lib/prisma.ts` keeps its client there.
const globalForRateLimit = globalThis as unknown as { __rateLimitBuckets?: Map<string, Bucket> }
const buckets: Map<string, Bucket> = globalForRateLimit.__rateLimitBuckets ?? new Map()
if (process.env.NODE_ENV !== 'production') globalForRateLimit.__rateLimitBuckets = buckets

/** Entries are only touched when their key is used, so expired ones need sweeping. */
let lastSweep = Date.now()
const SWEEP_INTERVAL_MS = 5 * 60 * 1000

function sweep(now: number) {
    if (now - lastSweep < SWEEP_INTERVAL_MS) return
    lastSweep = now
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key)
    }
}

export type RateLimitResult = {
    allowed: boolean
    /** Whole seconds until the window resets. Zero when the request was allowed. */
    retryAfterSeconds: number
}

/**
 * Records an attempt against `key` and reports whether it may proceed.
 *
 * @param key      What is being limited — e.g. `login:alice@example.com`. Callers should
 *                 namespace by action so a failed login cannot exhaust the signup budget.
 * @param limit    Attempts permitted per window.
 * @param windowMs Length of the window in milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now()
    sweep(now)

    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, retryAfterSeconds: 0 }
    }

    if (bucket.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
    }

    bucket.count += 1
    return { allowed: true, retryAfterSeconds: 0 }
}

/** Clears a key's counter — call after a *successful* login so one bad day of typos
 *  does not lock someone out once they have proved who they are. */
export function resetRateLimit(key: string): void {
    buckets.delete(key)
}

/** Phrases the wait in units a person reads naturally. */
export function retryAfterMessage(seconds: number): string {
    if (seconds <= 60) return `Please try again in ${seconds} second${seconds === 1 ? '' : 's'}.`
    const minutes = Math.ceil(seconds / 60)
    return `Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}
