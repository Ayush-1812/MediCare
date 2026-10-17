/**
 * Latency experiment harness for the voice receptionist.
 * ──────────────────────────────────────────────────────
 * Compares candidate Live configurations against the real provider and reports measured
 * first-audio latency for each. Written because "it feels slow" has several plausible
 * causes and guessing between them wastes more time than measuring does.
 *
 * Measures the gap between the end of the user's turn and the first byte of audio, which
 * is what a caller actually waits through. Each config runs several times and the median
 * is reported — a single sample of a hosted model over the internet is noise.
 *
 * Note what this canNOT measure: `silenceDurationMs`. That is the VAD's end-of-speech
 * timeout, and it only applies to a real microphone stream. This harness drives text
 * turns, so that delay is absent here and has to be reasoned about separately — it is
 * added to every spoken turn on top of whatever these numbers say.
 *
 *   npx tsx scripts/tune-voice-latency.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import { GoogleGenAI } from '@google/genai'
import { buildSystemInstruction, buildTimeContext } from '../src/lib/voice/prompt'
import { VOICE_TOOLS } from '../src/lib/voice/tools/definitions'

for (const file of ['.env.local', '.env']) {
    const full = path.join(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
        if (!match || process.env[match[1]]) continue
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
    }
}

const RUNS = 5
const time = buildTimeContext('Asia/Kolkata')
const SYSTEM = buildSystemInstruction(
    { name: 'Ayush Jangid', upcomingCount: 1, hasJoinableConsultation: false },
    'en-IN',
    time,
)

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string })

const CANNED = {
    total: 1,
    appointments: [
        { id: 'a1', doctor: 'Dr Mehta', when: '18 October 2026 at 04:30 PM', status: 'Scheduled', fee: 600 },
    ],
}

type Variant = {
    label: string
    model: string
    extra: Record<string, unknown>
    /** Shorter prompt variants test whether prompt size is actually costing anything. */
    system?: string
}

const BASE_TOOLS = [{ functionDeclarations: VOICE_TOOLS }]

const SHORT = [
    'You are Aether, the voice receptionist for MediCare. Speak in two or three short sentences.',
    'Never read an id aloud. Call a tool whenever the answer depends on real data.',
    'Confirm the weekday, date, exact time, timezone and fee before booking, and wait for a clear yes.',
].join(' ')

const VARIANTS: Variant[] = [
    { label: 'current shipping prompt', model: 'gemini-3.8-live', extra: {} },
    { label: 'SHORT prompt (~250 chars)', model: 'gemini-3.8-live', extra: {}, system: SHORT },
]

type Sample = { firstAudioMs: number; toolCalls: number; failed?: string }

async function measure(variant: Variant, prompt: string): Promise<Sample> {
    let turnStart = 0
    let firstAudioMs = 0
    let toolCalls = 0
    let failed: string | undefined
    let done: () => void = () => {}
    const finished = new Promise<void>((r) => (done = r))

    let session: any
    try {
        session = await ai.live.connect({
            model: variant.model,
            config: {
                responseModalities: ['AUDIO'],
                systemInstruction: variant.system ?? SYSTEM,
                tools: BASE_TOOLS,
                outputAudioTranscription: {},
                temperature: 0.3,
                ...variant.extra,
            } as never,
            callbacks: {
                onmessage: (m: any) => {
                    for (const part of m.serverContent?.modelTurn?.parts || []) {
                        if (part.inlineData?.data && !firstAudioMs) {
                            firstAudioMs = Date.now() - turnStart
                            done()
                        }
                    }
                    for (const call of m.toolCall?.functionCalls || []) {
                        toolCalls += 1
                        session.sendToolResponse({
                            functionResponses: [
                                { ...(call.id ? { id: call.id } : {}), name: call.name, response: { result: CANNED } },
                            ],
                        })
                    }
                },
                onerror: (e: any) => {
                    failed = String(e?.error?.message || e?.message || e).slice(0, 80)
                    done()
                },
                onclose: () => done(),
            },
        })
    } catch (error) {
        return { firstAudioMs: 0, toolCalls: 0, failed: String((error as Error).message).slice(0, 80) }
    }

    turnStart = Date.now()
    session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: prompt }] }], turnComplete: true })

    const timer = setTimeout(done, 30_000)
    await finished
    clearTimeout(timer)
    try {
        session.close()
    } catch {
        /* already closed */
    }
    return { firstAudioMs, toolCalls, failed }
}

function median(v: number[]): number {
    const s = v.slice().sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]
}

async function main() {
    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set.')
        process.exit(1)
    }

    console.log(`\nVoice latency tuning — ${RUNS} runs per case, median reported`)
    console.log(`  system prompt: ${SYSTEM.length} chars (~${Math.ceil(SYSTEM.length / 4)} tokens)`)
    console.log(`  measuring: end of user turn -> first audio byte`)
    console.log(`  NOT measured here: silenceDurationMs (VAD), which adds to every spoken turn\n`)

    const cases = [
        { key: 'no tool', prompt: 'Say hello in one short sentence.' },
        { key: 'one tool', prompt: 'What appointments do I have coming up?' },
    ]

    for (const variant of VARIANTS) {
        console.log(`  ${variant.label}`)
        for (const c of cases) {
            const samples: number[] = []
            let note = ''
            for (let i = 0; i < RUNS; i++) {
                const s = await measure(variant, c.prompt)
                if (s.failed) {
                    note = s.failed
                    break
                }
                if (s.firstAudioMs > 0) samples.push(s.firstAudioMs)
            }
            if (note) {
                console.log(`    ${c.key.padEnd(9)} UNSUPPORTED — ${note}`)
            } else if (samples.length === 0) {
                console.log(`    ${c.key.padEnd(9)} no audio produced`)
            } else {
                console.log(
                    `    ${c.key.padEnd(9)} median ${String(median(samples)).padStart(5)} ms   (${samples.join(', ')})`,
                )
            }
        }
        console.log()
    }
}

main().catch((e) => {
    console.error('\nTuning failed:', e)
    process.exitCode = 1
})
