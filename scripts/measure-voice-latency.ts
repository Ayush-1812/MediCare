/**
 * Latency measurement for the voice receptionist.
 * ───────────────────────────────────────────────
 * Measures what a patient actually waits for: the gap between their turn ending and the
 * first byte of spoken audio arriving. Reported as individual runs plus a median, because
 * a single sample of a network round trip to a hosted model is not a number worth quoting.
 *
 * Two cases are separated, since they are genuinely different experiences:
 *   · no tool call — the model answers directly
 *   · with a tool call — a lookup happens first, which is why the prompt instructs a short
 *     bridging phrase so the pause is not silence
 *
 * This measures provider and prompt cost only. It drives text turns, so it excludes
 * microphone capture and playback, and it excludes the real database (the tool returns
 * canned data). Those are measured where they are relevant: `verify:voice:audio` covers
 * the browser audio path, and the tool endpoint's own cost is a loopback call inside one
 * process.
 *
 *   npm run measure:voice
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

const MODEL = process.env.VOICE_MODEL || 'gemini-3.8-live'
const RUNS = 3

const time = buildTimeContext('Asia/Kolkata')
const SYSTEM = buildSystemInstruction(
    { name: 'Ayush Jangid', upcomingCount: 1, hasJoinableConsultation: false },
    'en-IN',
    time,
)

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string })

const CANNED = {
    filter: 'upcoming',
    total: 1,
    appointments: [
        {
            id: 'appt-1',
            doctor: 'Dr Mehta',
            when: '18 October 2026 at 04:30 PM',
            status: 'Scheduled',
            fee: 600,
            paid: false,
        },
    ],
}

type Sample = { setupMs: number; firstAudioMs: number; toolCalls: number }

async function measureOnce(prompt: string): Promise<Sample> {
    const connectStart = Date.now()
    let turnStart = 0
    let setupMs = 0
    let firstAudioMs = 0
    let toolCalls = 0
    let done: () => void = () => {}
    const finished = new Promise<void>((resolve) => {
        done = resolve
    })

    const session: any = await ai.live.connect({
        model: MODEL,
        config: {
            responseModalities: ['AUDIO'],
            systemInstruction: SYSTEM,
            tools: [{ functionDeclarations: VOICE_TOOLS }],
            outputAudioTranscription: {},
            temperature: 0.3,
        } as never,
        callbacks: {
            onmessage: (message: any) => {
                if (message.setupComplete && !setupMs) setupMs = Date.now() - connectStart

                for (const part of message.serverContent?.modelTurn?.parts || []) {
                    if (part.inlineData?.data && !firstAudioMs) {
                        firstAudioMs = Date.now() - turnStart
                        done()
                    }
                }

                for (const call of message.toolCall?.functionCalls || []) {
                    toolCalls += 1
                    session.sendToolResponse({
                        functionResponses: [
                            {
                                ...(call.id ? { id: call.id } : {}),
                                name: call.name,
                                response: { result: CANNED },
                            },
                        ],
                    })
                }
            },
            onerror: () => done(),
            onclose: () => done(),
        },
    })

    turnStart = Date.now()
    session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: prompt }] }],
        turnComplete: true,
    })

    const timer = setTimeout(done, 30_000)
    await finished
    clearTimeout(timer)
    try {
        session.close()
    } catch {
        /* already closed */
    }

    return { setupMs, firstAudioMs, toolCalls }
}

function median(values: number[]): number {
    const sorted = values.slice().sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
}

async function main() {
    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set.')
        process.exit(1)
    }

    console.log(`\nVoice latency — ${MODEL}, ${RUNS} runs per case`)
    console.log(`  system prompt: ${SYSTEM.length} chars (~${Math.ceil(SYSTEM.length / 4)} tokens)`)
    console.log(`  declared tools: ${VOICE_TOOLS.length}\n`)

    const cases: { label: string; prompt: string }[] = [
        { label: 'direct answer, no tool call', prompt: 'Say hello in one short sentence.' },
        { label: 'with one tool call', prompt: 'What appointments do I have coming up?' },
    ]

    const setupSamples: number[] = []

    for (const testCase of cases) {
        const samples: number[] = []
        let tools = 0
        for (let i = 0; i < RUNS; i++) {
            const sample = await measureOnce(testCase.prompt)
            // A run that produced no audio is a failed sample, not a fast one.
            if (sample.firstAudioMs > 0) samples.push(sample.firstAudioMs)
            if (sample.setupMs > 0) setupSamples.push(sample.setupMs)
            tools += sample.toolCalls
        }
        console.log(`  ${testCase.label}`)
        console.log(`    first audio: ${samples.join(' ms, ')} ms`)
        console.log(
            `    median: ${samples.length ? median(samples) : 'n/a'} ms` +
                `   (tool calls across runs: ${tools}, usable samples: ${samples.length}/${RUNS})`,
        )
    }

    console.log(`\n  session setup (connect → setupComplete): median ${median(setupSamples)} ms`)
    console.log('\n  Measured against a hosted model over the public internet from one')
    console.log('  machine. Treat as indicative of this environment, not as a benchmark.\n')
}

main().catch((error) => {
    console.error('\nMeasurement failed:', error)
    process.exitCode = 1
})
