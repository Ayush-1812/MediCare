/**
 * Reproducible demo: multilingual booking → correction → cancellation → recovery.
 * ──────────────────────────────────────────────────────────────────────────────
 * Drives a real Gemini Live session with the **real system prompt** and the **real
 * pending-action store**, standing in only for the database. So the confirmation binding,
 * the fingerprinting, the TTL and the single-claim semantics exercised here are the
 * shipping implementations, not a script's imitation of them.
 *
 * What it does NOT exercise: audio (this drives text turns), and Prisma. Tool results are
 * canned, which is why this is a demo rather than an integration test. The database path
 * is covered by `npm run test:voice` and by the manual run in PHASE6_REPORT.md.
 *
 *   npx tsx scripts/demo-voice.ts
 */

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { GoogleGenAI } from '@google/genai'
import { buildSystemInstruction, buildTimeContext } from '../src/lib/voice/prompt'
import { VOICE_TOOLS } from '../src/lib/voice/tools/definitions'

const require_ = createRequire(import.meta.url)
const { PendingActionStore } = require_('../server/voice/pendingActions.js')

for (const file of ['.env.local', '.env']) {
    const full = path.join(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
        if (!match || process.env[match[1]]) continue
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
    }
}

const MODEL = process.env.VOICE_MODEL || 'gemini-3.8-live'
const TIME_ZONE = 'Asia/Kolkata'
const IDLE_MS = 3_000
const TOTAL_TIMEOUT_MS = 180_000

const USER = 'demo-patient'
const SESSION = 'demo-socket'

const time = buildTimeContext(TIME_ZONE)
const store = new PendingActionStore()
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string })

/** Canned world. One doctor, three evening slots tomorrow, one booked appointment. */
const DOCTOR = { id: 'doc-mehta', name: 'Dr Mehta', speciality: 'Gastroenterologist', fee: 600 }
const SLOT_DATE_KEY = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return `${d.getDate()}_${d.getMonth() + 1}_${d.getFullYear()}`
})()
const SLOT_TIMES = ['05:00 PM', '05:30 PM', '06:00 PM']

let bookedAppointment: { id: string; slotTime: string } | null = null
let cancelled = false

const log = {
    step: (n: number, what: string) => console.log(`\n── ${n}. ${what} ${'─'.repeat(Math.max(0, 54 - what.length))}`),
    user: (t: string) => console.log(`  patient → ${t}`),
    said: (t: string) => console.log(`  Aether  ← ${t}`),
    tool: (t: string) => console.log(`  · tool: ${t}`),
    note: (t: string) => console.log(`  » ${t}`),
}

/**
 * Canned tool layer.
 *
 * `propose_*` returns the same shape `src/lib/voice/tools/actions.ts` produces, including
 * the `pendingAction` record — which is then handed to the real store, exactly as the
 * gateway does.
 */
function runTool(name: string, args: Record<string, any>): Record<string, any> {
    switch (name) {
        case 'search_doctors':
            return { ok: true, data: { count: 1, doctors: [DOCTOR] } }

        case 'get_doctor_availability':
            return {
                ok: true,
                data: {
                    found: true,
                    doctorId: DOCTOR.id,
                    doctor: DOCTOR.name,
                    fee: DOCTOR.fee,
                    acceptingBookings: true,
                    openDays: [
                        {
                            date: time.tomorrowLabel,
                            slotDateKey: SLOT_DATE_KEY,
                            times: SLOT_TIMES,
                            totalOpen: SLOT_TIMES.length,
                        },
                    ],
                },
            }

        case 'list_my_appointments':
            return {
                ok: true,
                data: {
                    filter: 'upcoming',
                    total: bookedAppointment && !cancelled ? 1 : 0,
                    appointments:
                        bookedAppointment && !cancelled
                            ? [
                                  {
                                      id: bookedAppointment.id,
                                      doctor: DOCTOR.name,
                                      when: `${time.tomorrowLabel} at ${bookedAppointment.slotTime}`,
                                      status: 'Scheduled',
                                      fee: DOCTOR.fee,
                                      paid: false,
                                  },
                              ]
                            : [],
                },
            }

        case 'propose_booking': {
            const slotTime = String(args.slotTime ?? '')
            if (!SLOT_TIMES.includes(slotTime)) {
                return {
                    ok: false,
                    data: { error: 'That doctor does not have a slot at that time.', remainingTimes: SLOT_TIMES },
                }
            }
            return {
                ok: true,
                data: {
                    proposed: true,
                    doctor: DOCTOR.name,
                    when: `${time.tomorrowLabel} at ${slotTime}`,
                    fee: DOCTOR.fee,
                    notYetBooked: true,
                },
                pendingAction: {
                    action: 'book',
                    params: { docId: DOCTOR.id, slotDate: SLOT_DATE_KEY, slotTime },
                    summary: `Book ${DOCTOR.name} on ${time.tomorrowLabel} at ${slotTime}, fee ₹${DOCTOR.fee}.`,
                },
            }
        }

        case 'propose_cancellation': {
            if (!bookedAppointment || cancelled) {
                return { ok: false, data: { error: 'Appointment not found.' } }
            }
            return {
                ok: true,
                data: {
                    proposed: true,
                    doctor: DOCTOR.name,
                    when: `${time.tomorrowLabel} at ${bookedAppointment.slotTime}`,
                    wasPaid: false,
                    notYetCancelled: true,
                },
                pendingAction: {
                    action: 'cancel',
                    params: { appointmentId: bookedAppointment.id },
                    summary: `Cancel the appointment with ${DOCTOR.name}.`,
                },
            }
        }

        default:
            return { ok: true, data: { note: 'Not available in this demo.' } }
    }
}

/** Mirrors the gateway's confirm/cancel handling, using the real store. */
function handleGatewayTool(name: string, args: Record<string, any>): Record<string, any> {
    if (name === 'cancel_pending_action') {
        const had = store.invalidate(USER, SESSION)
        log.note(`pending action ${had ? 'discarded' : 'was already absent'}`)
        return { ok: true, data: { cancelled: had, note: 'Nothing was changed.' } }
    }

    const claim = store.claim(USER, SESSION, {
        action: typeof args.action === 'string' ? args.action : undefined,
    })

    if (!claim.ok) {
        log.note(`confirm REFUSED — reason: ${claim.reason}`)
        const explanation: Record<string, string> = {
            none: 'There is nothing pending to confirm. Nothing has been changed. Propose again.',
            expired:
                'That proposal expired. Nothing has been changed. Re-check availability and propose afresh.',
            mismatch: 'That does not match what is pending, so nothing has been changed. Propose again.',
        }
        return { ok: false, data: { committed: false, reason: claim.reason, error: explanation[claim.reason] } }
    }

    const record = claim.record
    const replay = store.resultFor(record.idempotencyKey)
    if (replay) {
        log.note('idempotent replay — the recorded outcome was returned, nothing re-executed')
        return replay
    }

    let result: Record<string, any>
    if (record.action === 'book') {
        bookedAppointment = { id: 'appt-demo-1', slotTime: record.params.slotTime }
        cancelled = false
        result = {
            ok: true,
            data: {
                booked: true,
                appointmentId: bookedAppointment.id,
                amount: DOCTOR.fee,
                when: `${time.tomorrowLabel} at ${record.params.slotTime}`,
                paymentNote: 'Not paid yet. Offer to open the payment page.',
            },
        }
        log.note(`COMMITTED book → ${record.params.slotTime}`)
    } else {
        cancelled = true
        result = { ok: true, data: { cancelled: true } }
        log.note('COMMITTED cancel')
    }

    store.recordResult(record.idempotencyKey, result)
    return result
}

const GATEWAY_TOOLS = new Set(['confirm_action', 'cancel_pending_action'])

// ─── Session driver ──────────────────────────────────────────────────────────

type Script = { text: string; note?: string; before?: () => void }

async function run(turns: Script[], language: 'en-IN' | 'hi-IN') {
    let session: any
    let finish: () => void = () => {}
    const done = new Promise<void>((r) => (finish = r))

    let index = 0
    let transcript = ''
    let producedAudio = false
    let lastMessageAt = Date.now()

    const sendNext = () => {
        if (!session || index >= turns.length) return false
        const turn = turns[index++]
        if (turn.before) turn.before()
        if (transcript.trim()) log.said(transcript.trim())
        transcript = ''
        log.step(index, turn.note ?? 'turn')
        log.user(turn.text)
        session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: turn.text }] }],
            turnComplete: true,
        })
        return true
    }

    session = await ai.live.connect({
        model: MODEL,
        config: {
            responseModalities: ['AUDIO'],
            systemInstruction: buildSystemInstruction(
                { name: 'Ayush Jangid', upcomingCount: 0, hasJoinableConsultation: false },
                language,
                time,
            ),
            tools: [{ functionDeclarations: VOICE_TOOLS }],
            outputAudioTranscription: {},
            temperature: 0.3,
        } as never,
        callbacks: {
            onmessage: (message: Record<string, any>) => {
                lastMessageAt = Date.now()
                const content = message.serverContent
                if (content) {
                    for (const part of content.modelTurn?.parts || []) {
                        if (part.inlineData?.data) producedAudio = true
                    }
                    if (content.outputTranscription?.text) transcript += content.outputTranscription.text
                }

                for (const call of message.toolCall?.functionCalls || []) {
                    const args = call.args || {}
                    log.tool(`${call.name}(${JSON.stringify(args)})`)
                    const response = GATEWAY_TOOLS.has(call.name)
                        ? handleGatewayTool(call.name, args)
                        : runTool(call.name, args)

                    // The real gateway stores proposals here; so does the demo, in the
                    // real store.
                    if (response.ok && response.pendingAction) {
                        const record = store.propose(USER, SESSION, response.pendingAction)
                        log.note(`proposal stored (expires in ${Math.round((record.expiresAt - Date.now()) / 1000)}s)`)
                    }

                    session.sendToolResponse({
                        functionResponses: [
                            {
                                ...(call.id ? { id: call.id } : {}),
                                name: call.name,
                                response: { result: response.data },
                            },
                        ],
                    })
                }
            },
            onerror: (e: any) => {
                console.error('  provider error:', e?.message || e)
                finish()
            },
            onclose: () => finish(),
        },
    })

    const watchdog = setInterval(() => {
        if (!producedAudio || Date.now() - lastMessageAt < IDLE_MS) return
        producedAudio = false
        lastMessageAt = Date.now()
        if (!sendNext()) finish()
    }, 400)

    sendNext()
    const timer = setTimeout(finish, TOTAL_TIMEOUT_MS)
    await done
    clearInterval(watchdog)
    clearTimeout(timer)
    if (transcript.trim()) log.said(transcript.trim())
    try {
        session.close()
    } catch {
        /* already closed */
    }
}

async function main() {
    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set.')
        process.exit(1)
    }

    console.log('\n══ MediCare voice receptionist — demo ══')
    console.log(`model: ${MODEL}`)
    console.log(`now:   ${time.nowLabel} (${time.zoneLabel})`)
    console.log(`demo doctor: ${DOCTOR.name}, slots tomorrow: ${SLOT_TIMES.join(', ')}`)
    console.log('\nReal prompt, real pending-action store, canned database.')

    await run(
        [
            {
                text: 'Mujhe kal shaam Dr Mehta ke saath appointment chahiye',
                note: 'Hinglish booking request — "kal shaam" must not book on its own',
            },
            {
                text: 'Paanch baje theek hai',
                note: 'Patient picks 5 o\'clock',
            },
            {
                text: 'Nahi nahi, sorry — paanch baje nahi, paanch tees karo',
                note: 'CORRECTION mid-flow — the earlier proposal must be superseded',
            },
            {
                text: 'Haan, confirm kar do',
                note: 'Confirmation → commits 05:30 PM, not 05:00 PM',
            },
            {
                text: 'Actually, can you cancel that appointment please? And let us continue in English.',
                note: 'LANGUAGE SWITCH mid-conversation + cancellation request',
            },
            {
                text: 'Yes, please cancel it.',
                note: 'Confirm the cancellation',
            },
            {
                text: 'Book Dr Mehta for tomorrow at six o\'clock in the evening.',
                note: 'RECOVERY setup — a fresh proposal, which we then expire',
            },
            {
                text: 'Yes, confirm that.',
                note: 'RECOVERY — the proposal was expired behind the scenes; confirm must refuse and nothing may be booked',
                before: () => {
                    const record = store.peek(USER, SESSION)
                    if (record) {
                        store.pending.get(`${USER}:${SESSION}`).expiresAt = Date.now() - 1
                        log.note('(demo) the pending proposal was force-expired to test recovery')
                    }
                },
            },
        ],
        'hi-IN',
    )

    console.log('\n══ Final state ══')
    console.log(`  booked appointment: ${bookedAppointment ? bookedAppointment.slotTime : 'none'}`)
    console.log(`  cancelled: ${cancelled}`)
    console.log(`  pending proposal left over: ${store.peek(USER, SESSION) ? 'yes' : 'no'}`)
    console.log('\nExpected: 05:30 PM was booked (not 05:00), then cancelled, and the')
    console.log('expired proposal was refused rather than committed.\n')
}

main().catch((error) => {
    console.error('\nDemo crashed:', error)
    process.exitCode = 1
})
