/**
 * Commits a confirmed voice action.
 *
 * Separate from `/api/voice/tool` on purpose. That endpoint runs whatever tool the model
 * named; this one runs a mutation, and the only caller allowed to reach it is the gateway,
 * with parameters it read from its own pending-action store after the patient confirmed.
 * The model has no tool whose name routes here, so there is no path by which a generated
 * argument becomes a write.
 *
 * Three independent checks, none of which consult the model:
 *   1. the process-local gateway secret
 *   2. the patient's session cookie, verified by `getSessionId`
 *   3. ownership, re-checked inside the server action that actually performs the write
 *
 * Note what this route does NOT do: retry. A mutation whose outcome is unknown is reported
 * as unknown, and the gateway is required to read status before writing again. Retrying a
 * write you cannot see the result of is how one booking becomes two.
 */

import { NextResponse } from 'next/server'
import { getSessionId } from '@/lib/auth'
import { commitVoiceAction } from '@/lib/voice/tools/execute'

export const dynamic = 'force-dynamic'

const INTERNAL_HEADER = 'x-voice-internal'
const COMMIT_TIMEOUT_MS = 15_000

const ACTIONS = new Set(['book', 'cancel', 'reschedule'])

function deny(message: string, status: number) {
    return NextResponse.json({ ok: false, error: message }, { status })
}

export async function POST(request: Request) {
    const expected = process.env.VOICE_INTERNAL_SECRET
    if (!expected) return deny('Voice gateway is not running.', 503)
    if (request.headers.get(INTERNAL_HEADER) !== expected) return deny('Forbidden', 403)

    const userId = await getSessionId('user')
    if (!userId) return deny('Not signed in', 401)

    let body: { action?: unknown; params?: unknown }
    try {
        body = await request.json()
    } catch {
        return deny('Malformed body', 400)
    }

    const action = typeof body.action === 'string' ? body.action : ''
    if (!ACTIONS.has(action)) return deny(`Unknown action "${action}"`, 400)

    // Params must be a flat string map. Anything else is rejected rather than coerced —
    // this is the input to a database write, and being lenient here is how a malformed
    // value reaches a transaction.
    const raw = body.params
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return deny('params must be an object', 400)
    }
    const params: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value !== 'string') return deny(`params.${key} must be a string`, 400)
        if (value.length > 128) return deny(`params.${key} is too long`, 400)
        params[key] = value
    }

    try {
        const outcome = await Promise.race([
            commitVoiceAction(action, params),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('COMMIT_TIMEOUT')), COMMIT_TIMEOUT_MS),
            ),
        ])
        return NextResponse.json(outcome)
    } catch (error) {
        const timedOut = error instanceof Error && error.message === 'COMMIT_TIMEOUT'
        // The action name only — never the params, which identify a patient and an
        // appointment.
        console.error(`[voice:commit] ${action} failed:`, timedOut ? 'timeout' : error)

        if (timedOut) {
            // The write may or may not have landed. Saying so honestly is the only safe
            // answer; `outcomeUnknown` is what stops the gateway from trying again.
            return NextResponse.json({
                ok: false,
                outcomeUnknown: true,
                data: {
                    error:
                        'The request timed out and it is not clear whether it went through. ' +
                        'Tell the patient you are checking, then read their appointments back ' +
                        'to see the real state. Do not try the change again.',
                },
            })
        }

        return NextResponse.json({
            ok: false,
            data: { error: 'That change could not be completed. Nothing was altered.' },
        })
    }
}
