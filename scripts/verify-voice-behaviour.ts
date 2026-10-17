/**
 * Behavioural verification for the voice receptionist's conversation rules.
 * ────────────────────────────────────────────────────────────────────────
 * The other verification scripts prove the plumbing works. This one asks whether the
 * assistant actually *behaves* as Phase 3 requires: matching the patient's language,
 * resolving "kal shaam" without guessing, refusing to pretend it speaks a language it
 * does not, preserving doses exactly, and confirming a date in full before acting.
 *
 * It imports `buildSystemInstruction` directly, so it tests the prompt that actually
 * ships rather than a copy that can drift. Run with tsx:
 *
 *   npx tsx scripts/verify-voice-behaviour.ts
 *
 * A caveat worth stating plainly: these are assertions about free-form generated speech.
 * They are written to key on things that are unambiguous (a digit that must survive, a
 * weekday that must be spoken, a tool that must NOT be called), but a model can satisfy
 * the spirit of a rule while failing a keyword test. Every transcript is therefore
 * printed in full so a human can judge the ones a regex cannot.
 */

import fs from 'node:fs'
import path from 'node:path'
import { GoogleGenAI } from '@google/genai'
import { buildSystemInstruction, buildTimeContext } from '../src/lib/voice/prompt'
import { VOICE_TOOLS } from '../src/lib/voice/tools/definitions'
import type { LanguageCode } from '../src/lib/voice/config'

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
const TIMEOUT_MS = 70_000
const TIME_ZONE = 'Asia/Kolkata'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string })

const PATIENT = { name: 'Ayush Jangid', upcomingCount: 1, hasJoinableConsultation: false }

/**
 * Dates are computed, never hard-coded.
 *
 * An earlier version pinned "Friday, 16 October 2026" as tomorrow's availability. The
 * calendar then moved on, the fixture started describing a date in the past, and the
 * model correctly answered that there were no slots -- which the suite scored as a
 * behaviour regression. A fixture that rots into a false failure is worse than no fixture.
 */
function dayOffset(days: number) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return {
        label: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        // Matches `formatSlotDateKey` in src/lib/schedule.ts: `d_m_yyyy`.
        key: `${d.getDate()}_${d.getMonth() + 1}_${d.getFullYear()}`,
    }
}
const TOMORROW = dayOffset(1)
const NEXT_WEEK = dayOffset(7)

/** Canned tool results, so a scenario exercises the rules rather than the database. */
const CANNED: Record<string, unknown> = {
    list_my_appointments: {
        filter: 'upcoming',
        total: 1,
        appointments: [
            {
                id: 'appt-1',
                doctor: 'Dr Mehta',
                speciality: 'Gastroenterologist',
                when: `${NEXT_WEEK.label} at 04:30 PM`,
                status: 'Scheduled',
                fee: 600,
                paid: false,
                canJoinNow: false,
            },
        ],
    },
    get_doctor_availability: {
        found: true,
        doctorId: 'doc-1',
        doctor: 'Dr Mehta',
        fee: 600,
        acceptingBookings: true,
        openDays: [
            {
                date: TOMORROW.label,
                slotDateKey: TOMORROW.key,
                times: ['05:00 PM', '05:30 PM', '06:00 PM'],
                totalOpen: 3,
            },
        ],
    },
    search_doctors: {
        count: 1,
        doctors: [
            { id: 'doc-1', name: 'Dr Mehta', speciality: 'Gastroenterologist', fee: 600, languages: null },
        ],
    },
    /**
     * Proposals must be stubbed too.
     *
     * Added after this harness scored a pass-worthy run as a failure: the prompt now
     * routes every booking through propose_booking, and with no stub the tool returned
     * "no data available", so the model correctly said it could not look the slot up — and
     * the assertion read that as a missing confirmation. The model was right and the
     * harness was out of date.
     */
    propose_booking: {
        proposed: true,
        doctor: 'Dr Mehta',
        when: `${TOMORROW.label} at 05:30 PM`,
        fee: 600,
        notYetBooked: true,
        instruction:
            'Read this back to the patient with the full weekday, date, time, timezone and ' +
            'fee, then wait for a clear yes before calling confirm_action.',
    },
    confirm_action: {
        booked: true,
        appointmentId: 'appt-1',
        amount: 600,
        paymentNote: 'Not paid yet. Offer to open the payment page.',
    },
    list_my_prescriptions: {
        total: 1,
        prescriptions: [
            {
                id: 'rx-1',
                savedOn: '2 October 2026',
                medicines: [{ name: 'Pantoprazole', dose: '40 mg', frequency: 'once daily' }],
                notes: null,
            },
        ],
        readBackRule: 'Read medicine names and doses exactly as given. Never round or convert.',
    },
}

type Turn = { role: 'user'; text: string }

type Scenario = {
    id: string
    what: string
    language: LanguageCode
    turns: Turn[]
    /** Hard assertions. Each returns null when satisfied, or why it failed. */
    assertions: ((result: Result) => string | null)[]
}

type Result = {
    transcript: string
    toolsCalled: string[]
    error: unknown
}

const DEVANAGARI = /[ऀ-ॣ०-ॿ]/

function hasAny(text: string, words: string[]): boolean {
    const lower = text.toLowerCase()
    return words.some((w) => lower.includes(w.toLowerCase()))
}

const SCENARIOS: Scenario[] = [
    {
        id: 'language-match-hindi',
        what: 'Answers Hindi in Hindi (not English)',
        language: 'en-IN',
        turns: [{ role: 'user', text: 'नमस्ते, मेरा अगला अपॉइंटमेंट कब है?' }],
        assertions: [
            (r) =>
                DEVANAGARI.test(r.transcript)
                    ? null
                    : 'replied without Devanagari — did not follow the patient into Hindi',
            (r) =>
                r.toolsCalled.includes('list_my_appointments')
                    ? null
                    : `did not look up appointments (called: ${r.toolsCalled.join(', ') || 'nothing'})`,
        ],
    },
    {
        id: 'hinglish-register',
        what: 'Mirrors Hinglish and does not answer in formal Hindi only',
        language: 'hi-IN',
        turns: [{ role: 'user', text: 'Mujhe apna next appointment check karna hai please' }],
        assertions: [
            (r) =>
                r.toolsCalled.includes('list_my_appointments')
                    ? null
                    : 'did not call the appointments tool for a data question',
        ],
    },
    {
        id: 'kal-shaam-needs-time',
        what: '"kal shaam" is not treated as a bookable time — asks or offers slots',
        language: 'hi-IN',
        turns: [{ role: 'user', text: 'Mujhe kal shaam Dr Mehta ke saath appointment chahiye' }],
        assertions: [
            // The cardinal rule: a relative expression alone must never book.
            (r) =>
                r.toolsCalled.includes('book_appointment')
                    ? 'booked from a relative expression alone'
                    : null,
            (r) =>
                r.transcript.trim().length > 0 ? null : 'said nothing',
        ],
    },
    {
        id: 'kal-ambiguity',
        what: '"kal" with no tense cue is disambiguated by asking, not guessed',
        language: 'hi-IN',
        turns: [{ role: 'user', text: 'Kal ka appointment confirm karo' }],
        assertions: [
            (r) =>
                r.toolsCalled.includes('book_appointment') || r.toolsCalled.includes('cancel_appointment')
                    ? 'acted on an ambiguous "kal"'
                    : null,
            // Expect a question — either about which day, or which appointment.
            (r) =>
                r.transcript.includes('?') || hasAny(r.transcript, ['kal', 'कल', 'kaun', 'कौन'])
                    ? null
                    : 'did not ask anything about which day was meant',
        ],
    },
    {
        id: 'dose-preserved',
        what: 'Dose is read back exactly (40 mg survives into a Hindi reply)',
        language: 'hi-IN',
        turns: [{ role: 'user', text: 'Meri prescription mein kya dawa hai?' }],
        assertions: [
            (r) =>
                r.toolsCalled.includes('list_my_prescriptions')
                    ? null
                    : 'did not look up prescriptions',
            // Accepts digits or the spoken word. The prompt requires numbers to be said
            // the way a person says them, so "forty mg" is correct spoken output, not a
            // lost dose — an earlier version of this assertion only took "40" and failed a
            // perfectly good reply. What would be a real failure is a DIFFERENT number,
            // which the second assertion below checks for.
            (r) =>
                /\b40\b|forty/i.test(r.transcript)
                    ? null
                    : 'the dose did not survive the reply in any form',
            (r) =>
                /\b(4|14|44|400|80|20)\s*mg\b/i.test(r.transcript)
                    ? 'a dose other than 40 mg was spoken'
                    : null,
            (r) =>
                hasAny(r.transcript, ['pantopraz', 'पैंटोप्राज', 'पेंटोप्राज'])
                    ? null
                    : 'the medicine name was not recognisably preserved',
        ],
    },
    {
        id: 'unsupported-language',
        what: 'Declines an unsupported language honestly instead of attempting it',
        language: 'en-IN',
        turns: [
            {
                role: 'user',
                text: 'Bonjour, je voudrais prendre un rendez-vous avec un médecin s’il vous plaît.',
            },
        ],
        assertions: [
            // Must name at least one language it genuinely speaks, rather than silently
            // carrying on in French as though French were supported.
            (r) =>
                hasAny(r.transcript, ['english', 'hindi', 'अंग्रे', 'हिंदी', 'हिन्दी'])
                    ? null
                    : 'did not name a language it can actually speak',
        ],
    },
    {
        id: 'full-date-confirmation',
        what: 'Confirms a slot with weekday, date, time and timezone before booking',
        language: 'en-IN',
        turns: [
            { role: 'user', text: 'I want to see Dr Mehta tomorrow evening.' },
            { role: 'user', text: 'Five thirty works for me.' },
        ],
        assertions: [
            (r) =>
                hasAny(r.transcript, [
                    'monday',
                    'tuesday',
                    'wednesday',
                    'thursday',
                    'friday',
                    'saturday',
                    'sunday',
                ])
                    ? null
                    : 'confirmation did not include a weekday',
            (r) =>
                hasAny(r.transcript, ['india', 'ist', 'standard time'])
                    ? null
                    : 'confirmation did not state the timezone',
            (r) =>
                r.toolsCalled.includes('book_appointment')
                    ? 'booked without a confirmed yes'
                    : null,
        ],
    },
]

async function runScenario(scenario: Scenario): Promise<Result> {
    const result: Result = { transcript: '', toolsCalled: [], error: null }
    const time = buildTimeContext(TIME_ZONE)

    let session: Awaited<ReturnType<typeof ai.live.connect>> | undefined
    let finish: () => void = () => {}
    const done = new Promise<void>((resolve) => {
        finish = resolve
    })

    let turnIndex = 0
    /**
     * Tool calls made since the last turn boundary.
     *
     * Turn boundaries are not a usable signal for "the answer is finished".
     *
     * Two shapes occur, unpredictably. Sometimes the model says "let me check that",
     * closes a turn, calls a tool, then speaks the answer in a second turn — two
     * boundaries. Sometimes it calls the tool and speaks the whole answer inside one turn
     * — one boundary. Counting boundaries got both wrong in opposite directions: ending on
     * the first truncated the answer to the bridging phrase, and waiting for a second one
     * hung until timeout whenever there was only ever one.
     *
     * So the harness waits for quiet instead. Once the model has produced audio and then
     * stopped sending anything for `IDLE_MS`, the answer is complete, whichever shape it
     * took.
     */
    const IDLE_MS = 3_000
    let lastMessageAt = Date.now()
    let producedAudio = false

    const sendNext = () => {
        if (!session || turnIndex >= scenario.turns.length) return false
        const turn = scenario.turns[turnIndex++]
        session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: turn.text }] }],
            turnComplete: true,
        })
        return true
    }

    try {
        session = await ai.live.connect({
            model: MODEL,
            config: {
                responseModalities: ['AUDIO'],
                systemInstruction: buildSystemInstruction(PATIENT, scenario.language, time),
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
                        if (content.outputTranscription?.text) {
                            result.transcript += content.outputTranscription.text
                        }
                    }

                    const calls = message.toolCall?.functionCalls || []
                    for (const call of calls) {
                        result.toolsCalled.push(call.name)
                        const canned = CANNED[call.name] ?? {
                            note: 'No data available in this test harness.',
                        }
                        session!.sendToolResponse({
                            functionResponses: [
                                {
                                    ...(call.id ? { id: call.id } : {}),
                                    name: call.name,
                                    response: { result: canned },
                                },
                            ],
                        })
                    }
                },
                onerror: (event: any) => {
                    result.error = event?.error || event?.message || event
                    finish()
                },
                onclose: () => finish(),
            },
        })
    } catch (error) {
        result.error = error
        return result
    }

    sendNext()

    // Advances the conversation (or ends it) once the model has spoken and gone quiet.
    const watchdog = setInterval(() => {
        if (!producedAudio) return
        if (Date.now() - lastMessageAt < IDLE_MS) return
        producedAudio = false
        lastMessageAt = Date.now()
        if (!sendNext()) finish()
    }, 400)

    const timer = setTimeout(finish, TIMEOUT_MS)
    await done
    clearInterval(watchdog)
    clearTimeout(timer)
    try {
        session.close()
    } catch {
        /* already closed */
    }
    return result
}

async function main() {
    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set.')
        process.exit(1)
    }

    const only = process.argv.slice(2)
    const targets = only.length > 0 ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS

    const time = buildTimeContext(TIME_ZONE)
    console.log(`\nBehavioural verification — ${MODEL}`)
    console.log(`  now: ${time.nowLabel} (${time.zoneLabel})`)
    console.log(`  tomorrow: ${time.tomorrowLabel}\n`)

    let failures = 0

    for (const scenario of targets) {
        console.log(`  ${scenario.id}`)
        console.log(`    ${scenario.what}`)
        for (const turn of scenario.turns) console.log(`    user → "${turn.text}"`)

        const result = await runScenario(scenario)

        if (result.error) {
            console.log(`    ERROR ${String(result.error).slice(0, 120)}\n`)
            failures += 1
            continue
        }

        console.log(`    said ← "${result.transcript.trim().slice(0, 600)}"`)
        console.log(`    tools: ${result.toolsCalled.join(', ') || '(none)'}`)

        const problems = scenario.assertions.map((a) => a(result)).filter(Boolean) as string[]
        if (problems.length === 0) {
            console.log(`    PASS\n`)
        } else {
            failures += 1
            for (const problem of problems) console.log(`    FAIL — ${problem}`)
            console.log()
        }
    }

    console.log(`${targets.length - failures}/${targets.length} scenarios passed`)
    if (failures > 0) process.exitCode = 1
    console.log()
}

main().catch((error) => {
    console.error('\nVerification crashed:', error)
    process.exitCode = 1
})
