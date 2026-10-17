/**
 * Full-stack gateway test: drives OUR server the way the browser does.
 * ────────────────────────────────────────────────────────────────────
 * The provider-level tests all pass, including three consecutive spoken turns, so a
 * "replies once then goes silent" bug has to live in our own code — the gateway's turn
 * bookkeeping, or the events it emits to the client. Neither is exercised by a test that
 * talks to Gemini directly.
 *
 * So this connects a real Socket.IO client to the running server's `/voice` namespace,
 * streams real speech frames exactly as the capture worklet does, and prints every event
 * the server sends back with its turnId. If turn 2 never produces audio, the sequence
 * printed here says why.
 *
 * Auth: signs a session JWT locally with JWT_SECRET for an existing user id. That is a
 * signature operation plus one read — it writes nothing. Pass USER_ID to override.
 *
 *   npx tsx scripts/verify-voice-gateway.ts            (server must be running on :3000)
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
const IN_RATE = 16_000
const FRAME_MS = 20
const SILENCE_MS = 3_500
const TURNS = Number(process.env.TURNS || 8)
const CACHE = path.join(process.cwd(), 'scripts', '.vad-speech.pcm')

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string })

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

async function speechPcm(): Promise<Int16Array> {
    if (fs.existsSync(CACHE)) {
        const buf = fs.readFileSync(CACHE)
        return new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2)
    }
    const r: any = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: 'What appointments do I have coming up?',
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        } as never,
    })
    const b64 = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
    if (!b64) throw new Error('TTS returned no audio')
    const raw = Buffer.from(b64, 'base64')
    const at24 = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2)
    const at16 = resample(at24, 24_000, IN_RATE)
    fs.writeFileSync(CACHE, Buffer.from(at16.buffer, at16.byteOffset, at16.byteLength))
    return at16
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const AUDIO_HEADER_BYTES = 8

async function main() {
    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not set.')
        process.exit(1)
    }

    const token = jwt.sign({ id: USER_ID, role: 'user' }, process.env.JWT_SECRET, { expiresIn: 900 })
    const speech = await speechPcm()
    const samplesPerFrame = (IN_RATE * FRAME_MS) / 1000

    console.log(`\nGateway full-stack test — ${BASE}/voice, ${TURNS} spoken turns`)
    console.log(`  streaming ${FRAME_MS}ms frames exactly as the capture worklet does\n`)

    const socket = io(`${BASE}/voice`, {
        path: '/api/socket',
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: { cookie: `token=${token}` },
    })

    // Per-turn counters, so each turn's behaviour is visible separately.
    let audioFrames = 0
    let audioBytes = 0
    let firstAudioAt = 0
    let speechEndedAt = 0
    const turnIdsSeen = new Set<number>()
    let ready = false
    let fatal: string | null = null

    socket.on('connect_error', (e) => {
        fatal = `connect_error: ${e.message}`
    })
    socket.on('voice:ready', () => {
        ready = true
    })
    socket.on('voice:state', (p: any) => console.log(`      < state: ${p.state}`))
    // Node's socket.io delivers binary as a Buffer; the browser gets an ArrayBuffer.
    // Both are handled so this harness reads the same bytes the real client does.
    socket.on('voice:audio', (frame: ArrayBuffer | Buffer) => {
        const buf = Buffer.isBuffer(frame) ? frame : Buffer.from(new Uint8Array(frame))
        if (buf.length < AUDIO_HEADER_BYTES) return
        turnIdsSeen.add(buf.readUInt32LE(0))
        if (!firstAudioAt && speechEndedAt) firstAudioAt = Date.now() - speechEndedAt
        audioFrames += 1
        audioBytes += buf.length - AUDIO_HEADER_BYTES
    })
    socket.on('voice:transcript', (p: any) => {
        if (p.final || p.role === 'assistant') {
            console.log(`      < transcript [${p.role}] turn ${p.turnId}: "${p.text.trim().slice(0, 70)}"`)
        }
    })
    socket.on('voice:turn-complete', (p: any) => console.log(`      < TURN-COMPLETE turnId=${p.turnId}`))
    socket.on('voice:interrupted', (p: any) => console.log(`      < INTERRUPTED turnId=${p.turnId}`))
    socket.on('voice:reconnecting', (p: any) => console.log(`      < RECONNECTING ${JSON.stringify(p)}`))
    socket.on('voice:error', (p: any) => {
        console.log(`      < ERROR ${p.code} recoverable=${p.recoverable}: ${p.message}`)
        if (!p.recoverable) fatal = `fatal error: ${p.code}`
    })
    socket.on('disconnect', (r) => {
        fatal = fatal || `disconnected: ${r}`
    })

    for (let i = 0; i < 100 && !ready && !fatal; i++) await sleep(100)
    if (fatal) {
        console.log(`  could not start: ${fatal}\n`)
        socket.close()
        return
    }
    socket.emit('voice:start', { language: 'en-IN', timeZone: 'Asia/Kolkata' })
    for (let i = 0; i < 150 && !ready && !fatal; i++) await sleep(100)
    console.log(`  session ready\n`)

    const silence = new Int16Array(samplesPerFrame)

    for (let turn = 1; turn <= TURNS; turn++) {
        console.log(`  --- turn ${turn} ---`)
        audioFrames = 0
        audioBytes = 0
        firstAudioAt = 0
        speechEndedAt = 0
        turnIdsSeen.clear()

        for (let off = 0; off < speech.length && !fatal; off += samplesPerFrame) {
            const chunk = speech.subarray(off, Math.min(off + samplesPerFrame, speech.length))
            socket.emit('voice:audio', Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength))
            await sleep(FRAME_MS)
        }
        const spokeAt = Date.now()
        speechEndedAt = spokeAt

        for (let i = 0; i < SILENCE_MS / FRAME_MS && !fatal; i++) {
            socket.emit('voice:audio', Buffer.from(silence.buffer, 0, silence.byteLength))
            await sleep(FRAME_MS)
        }
        // Give any reply time to finish arriving.
        for (let i = 0; i < 60 && !fatal; i++) {
            await sleep(100)
            if (audioBytes > 0 && Date.now() - spokeAt > 5000) break
        }

        console.log(`      => first audio ${firstAudioAt || 'NONE'}ms | frames ${audioFrames} | bytes ${audioBytes} | turnIds [${[...turnIdsSeen].join(', ') || 'none'}]`)
        if (audioBytes === 0) console.log(`      => ** NO AUDIO REACHED THE CLIENT ON TURN ${turn} **`)
        if (fatal) {
            console.log(`      => ${fatal}`)
            break
        }
        await sleep(150)
    }

    socket.close()
    console.log(fatal ? `\n  ended: ${fatal}\n` : `\n  completed all ${TURNS} turns\n`)
}

main().catch((e) => {
    console.error('\nGateway test failed:', e)
    process.exitCode = 1
})
