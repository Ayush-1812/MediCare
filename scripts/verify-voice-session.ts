/**
 * Long-session stability test: does latency hold up over many turns?
 * ───────────────────────────────────────────────────────────────────
 * Reported symptom: accurate at first, then "fluctuating and delaying" after a few
 * replies. This drives OUR gateway over Socket.IO exactly as the browser does, for many
 * turns, and records per-turn latency so degradation shows up as a curve rather than an
 * impression.
 *
 * Behaves like a polite caller: a different question each turn, and it waits for the
 * previous reply to finish before speaking. An earlier harness re-asked one question and
 * spoke over unfinished replies, which made it impossible to tell a real defect from the
 * harness interrupting itself.
 *
 * Optional ECHO=1 mixes an attenuated copy of the assistant's own reply back into the
 * "microphone", the way laptop speakers leak into a laptop mic. That is the classic cause
 * of a voice agent that degrades over a session, and it cannot be seen without simulating
 * it — digital silence never contains an echo.
 *
 *   npx tsx scripts/verify-voice-session.ts
 *   ECHO=1 npx tsx scripts/verify-voice-session.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import jwt from 'jsonwebtoken'
import { io } from 'socket.io-client'
import { GoogleGenAI } from '@google/genai'

for (const file of ['.env.local', '.env']) {
    const full = path.join(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
        if (!m || process.env[m[1]]) continue
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
}

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000'
const USER_ID = process.env.USER_ID || 'cmvcbkvot0000jyn9vqk0g73h'
const ECHO = process.env.ECHO === '1'
const IN_RATE = 16_000
const OUT_RATE = 24_000
const FRAME_MS = 20
const HEADER = 8
const CACHE_DIR = path.join(process.cwd(), 'scripts', '.voice-cache')

/** Varied, realistic questions — no repetition for the model to loop on. */
const QUESTIONS = [
    'What appointments do I have coming up?',
    'Can you find me a dermatologist?',
    'How much does Doctor Aditi Sharma charge?',
    'Is my data secure on MediCare?',
    'Find me a pediatrician in Bengaluru.',
    'What is my blood group?',
    'Show me my prescriptions.',
    'Find a gastroenterologist under eight hundred rupees.',
    'Do you have any neurologists?',
    'Thank you, that is all.',
]

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

async function speechFor(text: string, index: number): Promise<Int16Array> {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    const file = path.join(CACHE_DIR, `q${index}.pcm`)
    if (fs.existsSync(file)) {
        const b = fs.readFileSync(file)
        return new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2)
    }
    // The free tier allows 3 TTS requests a minute, so a 429 is expected on a first run
    // and is retried after the delay the API asks for rather than treated as a failure.
    for (let attempt = 0; attempt < 6; attempt++) {
        try {
            const r: any = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: text,
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                } as never,
            })
            const b64 = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
            if (!b64) throw new Error('no audio')
            const raw = Buffer.from(b64, 'base64')
            const at16 = resample(new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2), 24_000, IN_RATE)
            fs.writeFileSync(file, Buffer.from(at16.buffer, at16.byteOffset, at16.byteLength))
            return at16
        } catch (e: any) {
            if (attempt === 5) throw e
            const wait = /retry in ([\d.]+)s/i.exec(String(e?.message))?.[1]
            const ms = wait ? Math.ceil(Number(wait) * 1000) + 1000 : 21_000
            process.stdout.write(`  (TTS rate-limited, waiting ${Math.round(ms / 1000)}s)\n`)
            await sleep(ms)
        }
    }
    throw new Error('unreachable')
}

type TurnStat = {
    turn: number
    question: string
    firstAudioMs: number | null
    replySeconds: number
    completed: boolean
    interrupted: boolean
    heard: string
    said: string
}

async function main() {
    const token = jwt.sign({ id: USER_ID, role: 'user' }, process.env.JWT_SECRET as string, { expiresIn: 1800 })
    const turns = Number(process.env.TURNS || QUESTIONS.length)

    console.log(`\nLong-session stability — ${turns} turns over ${BASE}/voice${ECHO ? ' — WITH SIMULATED ECHO' : ''}`)
    console.log('  synthesizing questions (cached after the first run)...')
    const clips: Int16Array[] = []
    for (let i = 0; i < turns; i++) clips.push(await speechFor(QUESTIONS[i % QUESTIONS.length], i % QUESTIONS.length))

    const socket = io(`${BASE}/voice`, {
        path: '/api/socket',
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: { cookie: `token=${token}` },
    })

    let ready = false
    let fatal: string | null = null
    let turnComplete = false
    let interrupted = false
    let firstAudioAt = 0
    let speechEndedAt = 0
    let replyBytes = 0
    let heard = ''
    let said = ''
    /** Assistant audio as 16kHz PCM, mixed back into the mic when ECHO=1. */
    let echoBuffer: Int16Array[] = []

    socket.on('connect_error', (e) => (fatal = `connect_error: ${e.message}`))
    socket.on('voice:ready', () => (ready = true))
    socket.on('voice:error', (p: any) => {
        if (!p.recoverable) fatal = `fatal: ${p.code} ${p.message}`
    })
    socket.on('disconnect', (r) => (fatal = fatal || `disconnected: ${r}`))
    socket.on('voice:turn-complete', () => (turnComplete = true))
    socket.on('voice:interrupted', () => (interrupted = true))
    socket.on('voice:transcript', (p: any) => {
        if (p.role === 'user' && p.final) heard += p.text
        if (p.role === 'assistant') said += p.text
    })
    socket.on('voice:audio', (frame: ArrayBuffer | Buffer) => {
        const buf = Buffer.isBuffer(frame) ? frame : Buffer.from(new Uint8Array(frame))
        if (buf.length <= HEADER) return
        if (!firstAudioAt && speechEndedAt) firstAudioAt = Date.now() - speechEndedAt
        replyBytes += buf.length - HEADER
        if (ECHO) {
            const pcm = new Int16Array(buf.buffer.slice(buf.byteOffset + HEADER, buf.byteOffset + buf.length))
            echoBuffer.push(resample(pcm, OUT_RATE, IN_RATE))
        }
    })

    for (let i = 0; i < 100 && !ready && !fatal; i++) await sleep(100)
    socket.emit('voice:start', { language: 'en-IN', timeZone: 'Asia/Kolkata' })
    for (let i = 0; i < 150 && !ready && !fatal; i++) await sleep(100)
    if (fatal) {
        console.log(`  could not start: ${fatal}\n`)
        socket.close()
        return
    }

    // Wait out the opening greeting, so turn 1 is measured against a quiet session.
    turnComplete = false
    for (let i = 0; i < 100 && !turnComplete && !fatal; i++) await sleep(100)
    await sleep(500)
    echoBuffer = []

    const samplesPerFrame = (IN_RATE * FRAME_MS) / 1000
    /** Pulls the next frame of echo (at 25% amplitude), or silence. */
    const echoFrame = (): Int16Array => {
        const out = new Int16Array(samplesPerFrame)
        if (!ECHO) return out
        let filled = 0
        while (filled < samplesPerFrame && echoBuffer.length) {
            const head = echoBuffer[0]
            const take = Math.min(head.length, samplesPerFrame - filled)
            for (let i = 0; i < take; i++) out[filled + i] = head[i] * 0.25
            filled += take
            if (take === head.length) echoBuffer.shift()
            else echoBuffer[0] = head.subarray(take)
        }
        return out
    }
    const send = (pcm: Int16Array) =>
        socket.emit('voice:audio', Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength))

    const stats: TurnStat[] = []

    for (let t = 0; t < turns && !fatal; t++) {
        turnComplete = false
        interrupted = false
        firstAudioAt = 0
        speechEndedAt = 0
        replyBytes = 0
        heard = ''
        said = ''

        const clip = clips[t]
        for (let off = 0; off < clip.length; off += samplesPerFrame) {
            send(clip.subarray(off, Math.min(off + samplesPerFrame, clip.length)))
            await sleep(FRAME_MS)
        }
        speechEndedAt = Date.now()

        // Keep the mic open (silence, or the assistant's own echo) until the reply has
        // finished — exactly what a live microphone does while someone listens.
        const deadline = Date.now() + 25_000
        while (!turnComplete && !fatal && Date.now() < deadline) {
            send(echoFrame())
            await sleep(FRAME_MS)
        }
        // Let any trailing audio and echo drain before the next question.
        for (let i = 0; i < 40 && !fatal; i++) {
            send(echoFrame())
            await sleep(FRAME_MS)
        }

        stats.push({
            turn: t + 1,
            question: QUESTIONS[t % QUESTIONS.length],
            firstAudioMs: firstAudioAt || null,
            replySeconds: Math.round((replyBytes / 2 / OUT_RATE) * 10) / 10,
            completed: turnComplete,
            interrupted,
            heard: heard.trim(),
            said: said.trim(),
        })

        const s = stats[stats.length - 1]
        console.log(
            `  turn ${String(s.turn).padStart(2)}  ${s.firstAudioMs === null ? '   NONE' : String(s.firstAudioMs).padStart(5) + 'ms'}` +
                `  reply ${String(s.replySeconds).padStart(4)}s  ${s.completed ? 'ok ' : 'TIMEOUT'}${s.interrupted ? ' INTERRUPTED' : ''}`,
        )
        console.log(`           Q: ${s.question}`)
        console.log(`           heard: "${s.heard.slice(0, 70)}"`)
        console.log(`           said:  "${s.said.slice(0, 90)}"`)
    }

    socket.close()

    const lat = stats.map((s) => s.firstAudioMs).filter((v): v is number => v !== null)
    const sorted = lat.slice().sort((a, b) => a - b)
    const half = Math.floor(stats.length / 2)
    const early = stats.slice(0, half).map((s) => s.firstAudioMs).filter((v): v is number => v !== null)
    const late = stats.slice(half).map((s) => s.firstAudioMs).filter((v): v is number => v !== null)
    const avg = (v: number[]) => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0)

    console.log(`\n  summary`)
    console.log(`    replies with audio:   ${lat.length}/${stats.length}`)
    console.log(`    timeouts:             ${stats.filter((s) => !s.completed).length}`)
    console.log(`    interrupted:          ${stats.filter((s) => s.interrupted).length}`)
    if (sorted.length) {
        console.log(`    first-audio median:   ${sorted[Math.floor(sorted.length / 2)]} ms   (min ${sorted[0]}, max ${sorted[sorted.length - 1]})`)
        console.log(`    first half avg:       ${avg(early)} ms`)
        console.log(`    second half avg:      ${avg(late)} ms   <- degradation shows here`)
    }
    if (fatal) console.log(`    ended early:          ${fatal}`)
    console.log()
}

main().catch((e) => {
    console.error('\nSession test failed:', e)
    process.exitCode = 1
})
