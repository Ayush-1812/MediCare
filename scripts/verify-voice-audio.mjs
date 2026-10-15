/**
 * Browser audio-pipeline verification for the voice receptionist.
 * ───────────────────────────────────────────────────────────────
 * Drives a real headless Chromium with a synthetic microphone and exercises the two
 * AudioWorklet processors directly. This covers the half of the feature that
 * `verify-voice.js` cannot: that half talks to Gemini and never touches our audio code,
 * while this one tests our audio code and never talks to Gemini.
 *
 * It needs no login and no database, by design. The worklets are pure signal plumbing, so
 * testing them in isolation keeps this runnable against any environment — including one
 * whose DATABASE_URL points at production, where minting a session to click through a UI
 * would mean reading a real patient's record into a test log.
 *
 * What it asserts:
 *   1. the capture context really runs at 16 kHz (the rate the Live API requires)
 *   2. the capture worklet emits fixed 320-sample PCM16 frames
 *   3. a non-silent input produces a non-zero peak — audio is actually flowing, not just
 *      frames of zeroes, which is what a broken graph looks like
 *   4. muting stops frames without tearing the graph down
 *   5. the playback context runs at 24 kHz and reports `drained` when audio ends
 *   6. `flush` empties the queue immediately — the barge-in guarantee
 *
 * Usage:  node scripts/verify-voice-audio.mjs          (boots its own server)
 *         BASE_URL=http://127.0.0.1:3000 node scripts/verify-voice-audio.mjs
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'

const PORT = Number(process.env.VERIFY_PORT || 3124)
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`
const OWN_SERVER = !process.env.BASE_URL

const checks = []
function record(name, ok, detail) {
    checks.push({ name, ok, detail })
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`)
}

/**
 * Writes a mono 16-bit PCM WAV of a 440 Hz tone.
 *
 * A tone rather than speech: this verifies the signal path, not recognition, and a tone
 * has a predictable amplitude so "is audio flowing" becomes a precise assertion instead
 * of a judgement call.
 */
function writeToneWav(filePath, { seconds = 5, sampleRate = 48_000, freq = 440 } = {}) {
    const samples = seconds * sampleRate
    const buffer = Buffer.alloc(44 + samples * 2)

    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(36 + samples * 2, 4)
    buffer.write('WAVE', 8)
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20) // PCM
    buffer.writeUInt16LE(1, 22) // mono
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(sampleRate * 2, 28)
    buffer.writeUInt16LE(2, 32)
    buffer.writeUInt16LE(16, 34)
    buffer.write('data', 36)
    buffer.writeUInt32LE(samples * 2, 40)

    for (let i = 0; i < samples; i++) {
        const value = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.6
        buffer.writeInt16LE(Math.round(value * 0x7fff), 44 + i * 2)
    }

    fs.writeFileSync(filePath, buffer)
    return filePath
}

/**
 * Finds a usable Chromium.
 *
 * Returns undefined when nothing better is found, which lets Playwright try its own
 * bundled build and produce its own (clear) error rather than us inventing one.
 */
function resolveChromium() {
    if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH

    const root = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright')
    if (fs.existsSync(root)) {
        // Highest build number first: the newest install is the one most likely to be
        // complete, and the directory name sorts numerically after the prefix.
        const builds = fs
            .readdirSync(root)
            .filter((name) => /^chromium-\d+$/.test(name))
            .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))

        for (const build of builds) {
            const exe = path.join(root, build, 'chrome-win64', 'chrome.exe')
            if (fs.existsSync(exe)) return exe
        }
    }

    for (const candidate of [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ]) {
        if (fs.existsSync(candidate)) return candidate
    }

    return undefined
}

async function waitForServer(url, timeoutMs = 90_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url, { method: 'GET' })
            if (res.status < 500) return true
        } catch {
            /* not up yet */
        }
        await new Promise((r) => setTimeout(r, 500))
    }
    return false
}

async function main() {
    const wavPath = path.join(os.tmpdir(), 'medicare-voice-tone.wav')
    writeToneWav(wavPath)
    console.log(`\nVerifying browser audio pipeline`)
    console.log(`  fake mic: ${wavPath}`)
    console.log(`  base url: ${BASE_URL}\n`)

    let server
    if (OWN_SERVER) {
        server = spawn(process.execPath, ['server.js'], {
            env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
            stdio: 'ignore',
        })
        const up = await waitForServer(`${BASE_URL}/about`)
        if (!up) {
            record('server booted', false, 'timed out')
            return finish(server)
        }
    }
    record('server reachable', true, BASE_URL)

    const browser = await chromium.launch({
        // `playwright-core` pins an exact browser build and refuses to start if the
        // installed one differs — this machine has chromium-1248 where 1.62.1 expects
        // 1234. Resolving the binary ourselves avoids a ~130 MB download for a
        // diagnostic, and `CHROMIUM_PATH` lets CI point at whatever it has.
        executablePath: resolveChromium(),
        args: [
            // Grants a synthetic mic so getUserMedia resolves with no prompt, and feeds it
            // from the generated WAV so the samples are known rather than silence.
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${wavPath}`,
            '--autoplay-policy=no-user-gesture-required',
        ],
    })

    try {
        const context = await browser.newContext({ permissions: ['microphone'] })
        const page = await context.newPage()
        // Navigate to a real page on the origin so `addModule('/voice/...')` is same-origin.
        await page.goto(`${BASE_URL}/about`, { waitUntil: 'domcontentloaded' })

        const worklets = await page.evaluate(async () => {
            const out = {}
            for (const name of ['capture-processor', 'playback-processor']) {
                const res = await fetch(`/voice/${name}.js`)
                out[name] = res.status
            }
            return out
        })
        record(
            'worklet modules served',
            worklets['capture-processor'] === 200 && worklets['playback-processor'] === 200,
            JSON.stringify(worklets),
        )

        // ── Capture ──────────────────────────────────────────────────────────
        const capture = await page.evaluate(async () => {
            const ctx = new AudioContext({ sampleRate: 16000 })
            await ctx.audioWorklet.addModule('/voice/capture-processor.js')

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
            })
            const source = ctx.createMediaStreamSource(stream)
            const node = new AudioWorkletNode(ctx, 'voice-capture', {
                numberOfOutputs: 0,
                processorOptions: { frameSamples: 320 },
            })

            const frames = []
            let peak = 0
            node.port.onmessage = (event) => {
                const data = event.data
                if (!data || data.type !== 'frame') return
                frames.push(data.pcm.byteLength)
                if (data.peak > peak) peak = data.peak
            }
            source.connect(node)

            await new Promise((r) => setTimeout(r, 1500))
            const whileLive = frames.length

            // Mute and confirm the stream genuinely stops rather than merely going quiet.
            node.port.postMessage({ type: 'mute', value: true })
            await new Promise((r) => setTimeout(r, 600))
            const afterMuteStart = frames.length
            await new Promise((r) => setTimeout(r, 600))
            const afterMuteEnd = frames.length

            const sampleRate = ctx.sampleRate
            const byteLengths = Array.from(new Set(frames))
            stream.getTracks().forEach((t) => t.stop())
            await ctx.close()

            return { whileLive, afterMuteStart, afterMuteEnd, peak, sampleRate, byteLengths }
        })

        record('capture context runs at 16 kHz', capture.sampleRate === 16000, `${capture.sampleRate} Hz`)
        record('capture emits frames', capture.whileLive > 10, `${capture.whileLive} frames in 1.5s`)
        record(
            'frames are 320-sample PCM16 (640 bytes)',
            capture.byteLengths.length === 1 && capture.byteLengths[0] === 640,
            `sizes seen: ${capture.byteLengths.join(', ')}`,
        )
        record(
            'microphone audio is non-silent',
            capture.peak > 0.05,
            `peak ${capture.peak.toFixed(3)}`,
        )
        record(
            'mute stops frames',
            capture.afterMuteEnd === capture.afterMuteStart,
            `${capture.afterMuteEnd - capture.afterMuteStart} frames after mute`,
        )

        // ── Playback ─────────────────────────────────────────────────────────
        const playback = await page.evaluate(async () => {
            const ctx = new AudioContext({ sampleRate: 24000 })
            await ctx.audioWorklet.addModule('/voice/playback-processor.js')
            const node = new AudioWorkletNode(ctx, 'voice-playback', { numberOfInputs: 0 })

            const events = []
            node.port.onmessage = (event) => events.push(event.data?.type)
            node.connect(ctx.destination)

            // ~0.25s of tone, pushed as several uneven chunks so the queue has to read
            // across chunk boundaries the way provider output does.
            const push = (seconds) => {
                const n = Math.floor(24000 * seconds)
                const pcm = new Float32Array(n)
                for (let i = 0; i < n; i++) pcm[i] = Math.sin((2 * Math.PI * 440 * i) / 24000) * 0.2
                node.port.postMessage({ type: 'push', pcm: pcm.buffer }, [pcm.buffer])
            }

            push(0.1)
            push(0.07)
            push(0.08)
            await new Promise((r) => setTimeout(r, 900))
            const drainedNormally = events.includes('drained')

            // Now the barge-in case: queue a long buffer and flush it immediately.
            events.length = 0
            push(3)
            await new Promise((r) => setTimeout(r, 60))
            const flushAt = performance.now()
            node.port.postMessage({ type: 'flush' })
            await new Promise((r) => setTimeout(r, 400))
            const flushed = events.includes('flushed')

            // If flush worked, three seconds of audio did NOT keep playing: pushing a short
            // buffer now should drain again quickly rather than queueing behind the old one.
            events.length = 0
            push(0.05)
            await new Promise((r) => setTimeout(r, 600))
            const drainedAfterFlush = events.includes('drained')
            const elapsed = performance.now() - flushAt

            const sampleRate = ctx.sampleRate
            await ctx.close()
            return { drainedNormally, flushed, drainedAfterFlush, sampleRate, elapsed }
        })

        record('playback context runs at 24 kHz', playback.sampleRate === 24000, `${playback.sampleRate} Hz`)
        record('playback drains and reports it', playback.drainedNormally)
        record('flush acknowledged', playback.flushed)
        record(
            'flush discards queued audio (barge-in)',
            playback.drainedAfterFlush && playback.elapsed < 1500,
            `drained ${Math.round(playback.elapsed)}ms after flushing a 3s buffer`,
        )
    } finally {
        await browser.close()
        finish(server)
    }
}

function finish(server) {
    if (server) server.kill()
    const failed = checks.filter((c) => !c.ok)
    console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
    if (failed.length > 0) {
        console.log('\nFailed:')
        for (const c of failed) console.log(`  · ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
        process.exitCode = 1
    }
    console.log()
}

main().catch((error) => {
    console.error('\nVerification crashed:', error)
    process.exitCode = 1
})
