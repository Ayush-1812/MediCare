/**
 * Read cache for the voice tool layer.
 *
 * Why this exists: measured against the configured database, a bare `SELECT 1` takes
 * 767-3,128 ms per round trip — with nothing else running. A healthy database answers that
 * in single-digit milliseconds. Every voice tool issues one to three queries, so a single
 * lookup was costing 2-9 seconds, and while the model waits on a tool the patient's next
 * sentence queues behind it. Over a few turns the whole conversation fell behind and never
 * caught up — the "fluctuating and delaying after some replies" that was reported.
 *
 * No code change makes a 1-3 second network round trip fast. What this does is stop the
 * conversation from waiting on it:
 *
 *  · Stale-while-revalidate. Once a value has been loaded, it is returned IMMEDIATELY even
 *    after it expires, and refreshed in the background. A voice turn never blocks on the
 *    database for a read it has seen before.
 *  · In-flight de-duplication. Two tools asking for the same thing at once share one query
 *    rather than paying the round trip twice.
 *  · Explicit invalidation after a write, so a patient who just booked hears the new
 *    appointment, not the cached list from before it.
 *
 * What this deliberately does NOT cache: anything that decides whether a write is allowed.
 * `propose_*` and `confirm_action` go to the database fresh every time, because a cached
 * "this slot is free" is exactly how two people get the same appointment.
 *
 * Per-process memory, which matches how the app runs: Next is embedded in `server.js`, so
 * route handlers share module state for the life of the process.
 */

type Entry<T> = { value: T; freshUntil: number; loadedAt: number }

const store = new Map<string, Entry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

/** Hard cap so a long-running process cannot grow this without bound. */
const MAX_ENTRIES = 2000

function evictIfFull() {
    if (store.size < MAX_ENTRIES) return
    // Oldest-loaded first. Map preserves insertion order, and entries are re-inserted on
    // refresh, so the first key is the least recently loaded.
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
}

function load<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const existing = inflight.get(key)
    if (existing) return existing as Promise<T>

    const promise = loader()
        .then((value) => {
            store.delete(key)
            evictIfFull()
            store.set(key, { value, freshUntil: Date.now() + ttlMs, loadedAt: Date.now() })
            return value
        })
        .finally(() => inflight.delete(key))

    inflight.set(key, promise)
    return promise
}

/**
 * Returns the cached value for `key`, loading it on a miss.
 *
 * Fresh hit: returned as-is. Stale hit: returned immediately, refreshed in the background.
 * Miss: waits for the load — the only case that pays the database round trip.
 */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const hit = store.get(key) as Entry<T> | undefined
    if (hit) {
        if (hit.freshUntil <= Date.now()) {
            // Background refresh; a failure here must not surface — the stale value is
            // still a correct answer to give right now, and the next call retries.
            load(key, ttlMs, loader).catch((error) =>
                console.error(`[voice:cache] background refresh failed for ${key.split(':')[0]}:`, error?.message),
            )
        }
        return hit.value
    }
    return load(key, ttlMs, loader)
}

/** Starts a load without waiting for it — used to warm the cache at session start. */
export function prime<T>(key: string, ttlMs: number, loader: () => Promise<T>): void {
    if (store.has(key) || inflight.has(key)) return
    load(key, ttlMs, loader).catch((error) =>
        console.error(`[voice:cache] prime failed for ${key.split(':')[0]}:`, error?.message),
    )
}

/** Drops every entry whose key starts with `prefix`. Called after any write. */
export function invalidate(prefix: string): void {
    for (const key of [...store.keys()]) {
        if (key.startsWith(prefix)) store.delete(key)
    }
}

/** Diagnostics only. */
export function cacheStats() {
    return { entries: store.size, inflight: inflight.size }
}

// ─── Keys and lifetimes ──────────────────────────────────────────────────────

/** Public doctor directory. Changes only when a doctor edits their profile. */
export const DOCTORS_KEY = 'doctors:all'
export const DOCTORS_TTL_MS = 60_000

/**
 * A patient's own records. Short, because a booking made in another tab should appear
 * within half a minute — and every write made through voice invalidates this immediately.
 */
export const PATIENT_TTL_MS = 30_000

export function patientKey(userId: string, what: string): string {
    return `patient:${userId}:${what}`
}

export function patientPrefix(userId: string): string {
    return `patient:${userId}:`
}
