/**
 * End-to-end VAD test: does a real audio turn ever complete on its own?
 * ─────────────────────────────────────────────────────────────────────
 * The other harnesses drive text turns, which bypass voice activity detection entirely.
 * That is precisely why a "the agent never replies until I press stop" bug could exist
 * while every one of them passed: pressing stop sends an explicit activity signal, which
 * forces the turn boundary that automatic VAD was supposed to produce.
 *
 * So this one streams REAL speech into a live session the way the browser does — 20ms
 * PCM16 frames at 16kHz, paced in real time — then keeps streaming digital silence, and
 * measures whether the provider ends the turn by itself and how long it takes.
 *
 * Speech is synthesized with Gemini TTS rather than shipped as a fixture, so there is no
 * binary blob in the repo and the phrase can be changed freely.
 *
 *   npx tsx scripts/verify-voice-vad.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import { GoogleGenAI } from '@google/genai'
import { buildSystemInstruction, buildTimeContext } from '../src/lib/voice/prompt'
import { VOICE_TOOLS } from '../src/lib/voice/tools/definitions'
import { buildLiveConfig } from '../src/lib/voice/liveConfig'

for (const file of ['.env.local', '.env']) {
    const full = path.join(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
        if (!m || process.env[m[1]]) continue
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
}

const MODEL = process.env.VOICE_MODEL || 'gemini-3.8-live'
const TTS_MODEL = 'gemini-2.5-flash-preview-tts'
const PHRASE = 'What appointments do I have coming up?'

const IN_RATE = 16_000
const TTS_RATE = 24_000
const FRAME_MS = 20
const SILENCE_MS = 3_000

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string })
const CACHE = path.join(process.cwd(), 'scripts', '.vad-speech.pcm')

/** Naive linear-interpolation resample, 24kHz TTS output down to the 16kHz the API wants. */
function resample(input: Int16Array, from: number, to: number): Int16Array {
    if (from === to) return input
    const ratio = from / to
    const out = new Int16Array(Math.floor(input.length / ratio))
    for (let i = 0; i < out.length; i++) {
        const src = i * ratio
        const i0 = Math.floor(src)
        const i1 = Math.min(i0 + 1, input.length - 1)
        out[i] = input[i0] + (input[i1] - input[i0]) * (src - i0)
    }
    return out
}

/** Synthesizes the probe phrase once and caches the raw PCM next to this script. */
async function speechPcm(): Promise<Int16Array> {
    if (fs.existsSync(CACHE)) {
        const buf = fs.readFileSync(CACHE)
        return new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2)
    }

    const response: any = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: PHRASE,
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        } as never,
    })

    const b64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
    if (!b64) throw new Error('TTS returned no audio')
    const raw = Buffer.from(b64, 'base64')
    const at24 = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2)
    const at16 = resample(at24, TTS_RATE, IN_RATE)
    fs.writeFileSync(CACHE, Buffer.from(at16.buffer, at16.byteOffset, at16.byteLength))
    return at16
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Result = {
    firstAudioMs: number | null
    turnCompleteMs: number | null
    transcript: string
    inputTranscript: string
    frames: number
}

/**
 * Streams speech then silence, exactly as the browser does.
 *
 * `batchFrames` groups N 20ms frames into one message. The browser currently sends every
 * frame individually, which is 50 provider messages a second — worth measuring against a
 * batched alternative.
 */
async function runTurn(batchFrames: number, label: string): Promise<Result> {
    const speech = await speechPcm()
    const samplesPerFrame = (IN_RATE * FRAME_MS) / 1000

    const time = buildTimeContext('Asia/Kolkata')
    const config = buildLiveConfig(
        { name: 'Ayush Jangid', upcomingCount: 1, hasJoinableConsultation: false },
        'en-IN',
        time,
    )

    const result: Result = {
        firstAudioMs: null,
        turnCompleteMs: null,
        transcript: '',
        inputTranscript: '',
        frames: 0,
    }

    let speechEndedAt = 0
    let done: () => void = () => {}
    const finished = new Promise<void>((r) => (done = r))

    const session: any = await ai.live.connect({
        model: MODEL,
        config: config as never,
        callbacks: {
            onmessage: (m: any) => {
                const c = m.serverContent
                if (c?.inputTranscription?.text) result.inputTranscript += c.inputTranscription.text
                if (c?.outputTranscription?.text) result.transcript += c.outputTranscription.text
                for (const part of c?.modelTurn?.parts || []) {
                    if (part.inlineData?.data && result.firstAudioMs === null && speechEndedAt) {
                        result.firstAudioMs = Date.now() - speechEndedAt
                    }
                }
                if ((c?.turnComplete || c?.generationComplete) && speechEndedAt && result.turnCompleteMs === null) {
                    result.turnCompleteMs = Date.now() - speechEndedAt
                    done()
                }
                for (const call of m.toolCall?.functionCalls || []) {
                    session.sendToolResponse({
                        functionResponses: [
                            {
                                ...(call.id ? { id: call.id } : {}),
                                name: call.name,
                                response: { result: { total: 0, appointments: [] } },
                            },
                        ],
                    })
                }
            },
            onerror: (e: any) => {
                console.log(`    provider error: ${e?.message || e}`)
                done()
            },
            onclose: () => done(),
        },
    })

    const send = (pcm: Int16Array) => {
        const buf = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)
        session.sendRealtimeInput({
            audio: { data: buf.toString('base64'), mimeType: `audio/pcm;rate=${IN_RATE}` },
        })
        result.frames += 1
    }

    // Speech, paced in real time so the VAD sees it as it would from a microphone.
    let batch: number[] = []
    for (let off = 0; off < speech.length; off += samplesPerFrame) {
        batch.push(off)
        if (batch.length === batchFrames) {
            send(speech.subarray(batch[0], Math.min(batch[0] + samplesPerFrame * batchFrames, speech.length)))
            await sleep(FRAME_MS * batchFrames)
            batch = []
        }
    }
    if (batch.length) {
        send(speech.subarray(batch[0]))
        await sleep(FRAME_MS * batch.length)
    }

    speechEndedAt = Date.now()

    // Then digital silence, exactly as a live microphone keeps streaming after you stop.
    const silence = new Int16Array(samplesPerFrame * batchFrames)
    const iterations = Math.floor(SILENCE_MS / (FRAME_MS * batchFrames))
    for (let i = 0; i < iterations; i++) {
        if (result.turnCompleteMs !== null) break
        send(silence)
        await sleep(FRAME_MS * batchFrames)
    }

    const guard = setTimeout(done, 15_000)
    await finished
    clearTimeout(guard)
    try {
        session.close()
    } catch {
        /* already closed */
    }

    void label
    return result
}


/**
 * Three consecutive spoken turns in ONE session.
 *
 * This is the case the single-turn test above cannot see, and the one actually reported:
 * the first reply arrives, and then nothing ever does again. Each turn streams speech,
 * then silence, and waits for the provider to close the turn on its own.
 */
async function runMultiTurn(turnCount: number) {
    const speech = await speechPcm()
    const samplesPerFrame = (IN_RATE * FRAME_MS) / 1000
    const time = buildTimeContext('Asia/Kolkata')
    const config = buildLiveConfig(
        { name: 'Ayush Jangid', upcomingCount: 1, hasJoinableConsultation: false },
        'en-IN',
        time,
    )

    let speechEndedAt = 0
    let turnDone: (() => void) | null = null
    let firstAudioMs: number | null = null
    let turnCompleteMs: number | null = null
    let heard = ''
    let said = ''
    let providerError: string | null = null

    const session: any = await ai.live.connect({
        model: MODEL,
        config: config as never,
        callbacks: {
            onmessage: (m: any) => {
                const c = m.serverContent
                if (c?.inputTranscription?.text) heard += c.inputTranscription.text
                if (c?.outputTranscription?.text) said += c.outputTranscription.text
                for (const part of c?.modelTurn?.parts || []) {
                    if (part.inlineData?.data && firstAudioMs === null && speechEndedAt) {
                        firstAudioMs = Date.now() - speechEndedAt
                    }
                }
                if ((c?.turnComplete || c?.generationComplete) && speechEndedAt && turnCompleteMs === null) {
                    turnCompleteMs = Date.now() - speechEndedAt
                    turnDone?.()
                }
                for (const call of m.toolCall?.functionCalls || []) {
                    session.sendToolResponse({
                        functionResponses: [
                            {
                                ...(call.id ? { id: call.id } : {}),
                                name: call.name,
                                response: { result: { total: 0, appointments: [] } },
                            },
                        ],
                    })
                }
            },
            onerror: (e: any) => {
                providerError = String(e?.message || e?.error?.message || e).slice(0, 140)
                turnDone?.()
            },
            onclose: (e: any) => {
                if (!providerError) providerError = `socket closed${e?.reason ? `: ${e.reason}` : ''}`
                turnDone?.()
            },
        },
    })

    const send = (pcm: Int16Array) => {
        const buf = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)
        session.sendRealtimeInput({
            audio: { data: buf.toString('base64'), mimeType: `audio/pcm;rate=${IN_RATE}` },
        })
    }
    const silenceFrame = new Int16Array(samplesPerFrame)

    for (let turn = 1; turn <= turnCount; turn++) {
        firstAudioMs = null
        turnCompleteMs = null
        said = ''
        const heardBefore = heard.length
        speechEndedAt = 0

        const settled = new Promise<void>((r) => (turnDone = r))

        for (let off = 0; off < speech.length; off += samplesPerFrame) {
            send(speech.subarray(off, Math.min(off + samplesPerFrame, speech.length)))
            await sleep(FRAME_MS)
        }
        speechEndedAt = Date.now()

        for (let i = 0; i < SILENCE_MS / FRAME_MS; i++) {
            if (turnCompleteMs !== null || providerError) break
            send(silenceFrame)
            await sleep(FRAME_MS)
        }

        const guard = setTimeout(() => turnDone?.(), 12_000)
        await settled
        clearTimeout(guard)

        console.log(`    turn ${turn}:`)
        console.log(`      heard:     "${heard.slice(heardBefore).trim() || '(nothing)'}"`)
        console.log(
            `      completed: ${turnCompleteMs === null ? '** NEVER **' : turnCompleteMs + ' ms after speech ended'}`,
        )
        console.log(`      said:      "${said.trim().slice(0, 100) || '(nothing)'}"`)
        if (providerError) {
            console.log(`      ERROR:     ${providerError}`)
            break
        }
        await sleep(600)
    }

    try {
        session.close()
    } catch {
        /* already closed */
    }
    return providerError
}

async function main() {
    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set.')
        process.exit(1)
    }
    console.log(`\nMulti-turn VAD test — 3 consecutive spoken turns in one session`)
    console.log(`  phrase: "${PHRASE}"  model: ${MODEL}\n`)
    const err = await runMultiTurn(3)
    console.log(err ? `\n  session ended early: ${err}\n` : `\n  all turns completed\n`)
}

main().catch((e) => {
    console.error('\nVAD test failed:', e)
    process.exitCode = 1
})
