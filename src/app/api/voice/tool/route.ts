/**
 * Internal tool-execution endpoint for the voice gateway.
 *
 * The gateway (`server/voice/gateway.js`) runs in the same Node process as Next but
 * outside its request pipeline, so it cannot call server actions directly — those resolve
 * identity through `cookies()`. It therefore forwards the caller's own session cookie to
 * this route, where the real actions run under the real session.
 *
 * Two independent checks guard it:
 *
 *  1. The session cookie, verified by `getSessionId` exactly as everywhere else. The
 *     authenticated id is the only source of identity — the request body cannot name a
 *     user, so a prompt-injected transcript cannot reach another patient's record.
 *  2. A process-local shared secret that the gateway sets on `process.env` before Next
 *     boots. Because Next is embedded in `server.js`, both sides read the same value
 *     without it ever leaving the process or reaching the browser. This stops a page in
 *     the user's own browser from driving the tool surface directly.
 */

import { NextResponse } from 'next/server'
import { getSessionId } from '@/lib/auth'
import { executeVoiceTool, type ToolArgs } from '@/lib/voice/tools/execute'
import { TOOL_NAMES } from '@/lib/voice/tools/definitions'
import { TOOL_TIMEOUT_MS } from '@/lib/voice/config'

export const dynamic = 'force-dynamic'

const INTERNAL_HEADER = 'x-voice-internal'

function deny(message: string, status: number) {
    return NextResponse.json({ ok: false, error: message }, { status })
}

export async function POST(request: Request) {
    const expected = process.env.VOICE_INTERNAL_SECRET
    // A missing secret means the gateway never started. Failing closed is correct: the
    // alternative is an unauthenticated tool endpoint whenever boot order changes.
    if (!expected) return deny('Voice gateway is not running.', 503)
    if (request.headers.get(INTERNAL_HEADER) !== expected) return deny('Forbidden', 403)

    const userId = await getSessionId('user')
    if (!userId) return deny('Not signed in', 401)

    let body: { name?: unknown; args?: unknown }
    try {
        body = await request.json()
    } catch {
        return deny('Malformed body', 400)
    }

    const name = typeof body.name === 'string' ? body.name : ''
    if (!TOOL_NAMES.includes(name)) return deny(`Unknown tool "${name}"`, 400)

    const args: ToolArgs =
        body.args && typeof body.args === 'object' && !Array.isArray(body.args)
            ? (body.args as ToolArgs)
            : {}

    try {
        // The model is waiting on this with an open microphone, so a hung query must
        // surface as a spoken "I couldn't look that up" rather than silence.
        const outcome = await Promise.race([
            executeVoiceTool(userId, name, args),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('TOOL_TIMEOUT')), TOOL_TIMEOUT_MS),
            ),
        ])
        return NextResponse.json(outcome)
    } catch (error) {
        const timedOut = error instanceof Error && error.message === 'TOOL_TIMEOUT'
        console.error(`[voice:tool] ${name} failed:`, error)
        return NextResponse.json(
            {
                ok: false,
                data: {
                    error: timedOut
                        ? 'That lookup took too long. Tell the patient you could not retrieve it.'
                        : 'That lookup failed. Tell the patient you could not retrieve it.',
                },
            },
            // 200 on purpose: this is a tool *result* the model must narrate, not a
            // transport failure for the gateway to retry.
            { status: 200 },
        )
    }
}
