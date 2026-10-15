/**
 * Per-language verification for the voice receptionist.
 * ─────────────────────────────────────────────────────
 * The Live API advertises ~70 languages. That is a claim about the model, not a promise
 * that every `languageCode` we might put in a picker produces usable speech. Phase 3
 * requires that we never imply an unsupported language works, so each language the UI
 * offers is tested here against the real provider before it ships.
 *
 * For each language this opens a session, asks a question written in that language, and
 * checks:
 *   · setup is accepted with that `speechConfig.languageCode`
 *   · native audio comes back
 *   · an output transcript comes back
 *   · the transcript is in the script that language is written in — the check that
 *     catches "accepted the code but answered in English", which is exactly the silent
 *     failure that would make the picker a lie
 *
 * Also exercises Hindi-English code-switching, which is the realistic input for this app
 * and the single strongest reason Phase 2 chose native audio over an STT pipeline.
 *
 * Usage:  node scripts/verify-voice-languages.js
 *         node scripts/verify-voice-languages.js hi-IN mr-IN     (subset)
 */

const fs = require('fs')
const path = require('path')

for (const file of ['.env.local', '.env']) {
    const full = path.join(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
        if (!match || process.env[match[1]]) continue
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
    }
}

const { GoogleGenAI } = require('@google/genai')

const MODEL = process.env.VOICE_MODEL || 'gemini-3.8-live'
const VOICE_NAME = process.env.VOICE_NAME || 'Zephyr'
const PER_LANGUAGE_TIMEOUT_MS = 30_000

/** Unicode block per writing system, used to tell a real reply from an English one. */
const SCRIPTS = {
    latin: /[A-Za-z]/,
    devanagari: /[ऀ-ॿ]/,
    bengali: /[ঀ-৿]/,
    gurmukhi: /[਀-੿]/,
    gujarati: /[઀-૿]/,
    tamil: /[஀-௿]/,
    telugu: /[ఀ-౿]/,
    kannada: /[ಀ-೿]/,
    malayalam: /[ഀ-ൿ]/,
}

const LANGUAGES = [
    { code: 'en-IN', label: 'English (India)', script: 'latin', probe: 'What can you help me with?' },
    { code: 'hi-IN', label: 'Hindi', script: 'devanagari', probe: 'आप मेरी किस तरह मदद कर सकते हैं?' },
    { code: 'bn-IN', label: 'Bengali', script: 'bengali', probe: 'আপনি আমাকে কীভাবে সাহায্য করতে পারেন?' },
    { code: 'ta-IN', label: 'Tamil', script: 'tamil', probe: 'நீங்கள் எனக்கு எப்படி உதவ முடியும்?' },
    { code: 'te-IN', label: 'Telugu', script: 'telugu', probe: 'మీరు నాకు ఎలా సహాయం చేయగలరు?' },
    { code: 'mr-IN', label: 'Marathi', script: 'devanagari', probe: 'तुम्ही मला कशी मदत करू शकता?' },
    { code: 'gu-IN', label: 'Gujarati', script: 'gujarati', probe: 'તમે મને કેવી રીતે મદદ કરી શકો?' },
    { code: 'kn-IN', label: 'Kannada', script: 'kannada', probe: 'ನೀವು ನನಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?' },
    { code: 'ml-IN', label: 'Malayalam', script: 'malayalam', probe: 'നിങ്ങൾ എന്നെ എങ്ങനെ സഹായിക്കും?' },
    { code: 'pa-IN', label: 'Punjabi', script: 'gurmukhi', probe: 'ਤੁਸੀਂ ਮੇਰੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦੇ ਹੋ?' },
    { code: 'en-US', label: 'English (US)', script: 'latin', probe: 'What can you help me with?' },
]

/** Hinglish: Latin-script Hindi mixed with English, the actual input this app will get. */
const CODE_SWITCH_PROBE = {
    code: 'hi-IN',
    label: 'Hindi-English code-switching',
    probe: 'Mujhe kal shaam Dr Mehta ke saath appointment chahiye, kya slot available hai?',
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

async function probeLanguage({ code, probe }) {
    const result = {
        setup: false,
        audioBytes: 0,
        transcript: '',
        error: null,
    }

    let session
    let finish
    const done = new Promise((resolve) => {
        finish = resolve
    })

    try {
        session = await ai.live.connect({
            model: MODEL,
            config: {
                responseModalities: ['AUDIO'],
                systemInstruction:
                    'You are a telemedicine receptionist. Reply in exactly one short ' +
                    "sentence, in the same language as the user's message.",
                speechConfig: {
                    languageCode: code,
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
                },
                outputAudioTranscription: {},
                temperature: 0.3,
            },
            callbacks: {
                onmessage: (message) => {
                    if (message.setupComplete) result.setup = true
                    const content = message.serverContent
                    if (!content) return
                    for (const part of content.modelTurn?.parts || []) {
                        if (part.inlineData?.data) {
                            result.audioBytes += Buffer.from(part.inlineData.data, 'base64').length
                        }
                    }
                    if (content.outputTranscription?.text) {
                        result.transcript += content.outputTranscription.text
                    }
                    if ((content.turnComplete || content.generationComplete) && result.audioBytes > 0) {
                        finish()
                    }
                },
                onerror: (event) => {
                    result.error = (event && (event.error || event.message)) || event
                    finish()
                },
                onclose: () => finish(),
            },
        })
    } catch (error) {
        result.error = error.message
        return result
    }

    session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: probe }] }],
        turnComplete: true,
    })

    const timer = setTimeout(finish, PER_LANGUAGE_TIMEOUT_MS)
    await done
    clearTimeout(timer)
    try {
        session.close()
    } catch {
        /* already closed */
    }
    return result
}

/**
 * Classifies text by its majority script.
 *
 * Two traps here, both of which produced wrong answers on the first run of this script:
 *
 *  1. The danda `।` (U+0964) and double danda (U+0965) sit in the *Devanagari* Unicode
 *     block but are shared sentence punctuation across Bengali, Punjabi, Gujarati and
 *     others. A first-match test therefore labelled perfectly good Bengali and Punjabi
 *     replies as Devanagari and failed them. They are stripped before classifying.
 *  2. An Indic reply routinely contains Latin digits, a doctor's name or a borrowed word
 *     like "appointment", so presence-testing Latin matches nearly everything. Counting
 *     characters and taking the majority is the only reliable reading.
 */
function scriptOf(text) {
    const cleaned = text
        .replace(/[।॥]/g, '') // shared Indic danda punctuation
        .replace(/[\s\d\p{P}\p{S}]/gu, '') // whitespace, digits, punctuation, symbols
    if (!cleaned) return 'unknown'

    let best = 'unknown'
    let bestCount = 0
    for (const [name, pattern] of Object.entries(SCRIPTS)) {
        const global = new RegExp(pattern.source, 'g')
        const count = (cleaned.match(global) || []).length
        if (count > bestCount) {
            best = name
            bestCount = count
        }
    }
    return best
}

/**
 * A session can complete a turn having emitted a token amount of audio — a few hundred
 * bytes is a couple of milliseconds, which is silence, not speech. `audioBytes > 0` let
 * that through on the first run (Tamil returned 118 bytes and was scored a pass), so a
 * real floor is required. At 24 kHz mono PCM16, 24,000 bytes is half a second.
 */
const MIN_AUDIO_BYTES = 24_000

function audioMs(bytes) {
    return Math.round((bytes / 2 / 24_000) * 1000)
}

async function main() {
    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set.')
        process.exit(1)
    }

    const only = process.argv.slice(2)
    const targets = only.length > 0 ? LANGUAGES.filter((l) => only.includes(l.code)) : LANGUAGES

    console.log(`\nPer-language verification — model ${MODEL}, voice ${VOICE_NAME}\n`)

    const rows = []
    for (const language of targets) {
        process.stdout.write(`  ${language.code.padEnd(6)} ${language.label.padEnd(18)} `)
        const result = await probeLanguage(language)
        const detected = scriptOf(result.transcript)
        const scriptOk = detected === language.script
        const enoughAudio = result.audioBytes >= MIN_AUDIO_BYTES
        const ok = result.setup && enoughAudio && result.transcript.trim() !== '' && scriptOk

        rows.push({ ...language, ...result, detected, ok })
        console.log(
            ok
                ? `OK    ${String(audioMs(result.audioBytes)).padStart(5)}ms audio  script ${detected}`
                : `FAIL  ${
                      result.error
                          ? String(result.error).slice(0, 60)
                          : !result.setup
                            ? 'setup rejected'
                            : !enoughAudio
                              ? `only ${audioMs(result.audioBytes)}ms of audio (${result.audioBytes}B) — effectively silence`
                              : !result.transcript.trim()
                                ? 'no transcript'
                                : `replied in ${detected}, expected ${language.script}`
                  }`,
        )
        if (result.transcript.trim()) {
            console.log(`         ↳ "${result.transcript.trim().slice(0, 90)}"`)
        }
    }

    // ── Code-switching ───────────────────────────────────────────────────────
    if (only.length === 0) {
        console.log(`\n  Code-switching probe (Hinglish, Latin script input)`)
        const cs = await probeLanguage(CODE_SWITCH_PROBE)
        const ok = cs.setup && cs.audioBytes >= MIN_AUDIO_BYTES && cs.transcript.trim() !== ''
        console.log(`  ${ok ? 'OK' : 'FAIL'}  ${audioMs(cs.audioBytes)}ms audio`)
        if (cs.transcript.trim()) console.log(`         ↳ "${cs.transcript.trim().slice(0, 140)}"`)
        rows.push({ code: 'hinglish', label: CODE_SWITCH_PROBE.label, ok, transcript: cs.transcript })
    }

    const passed = rows.filter((r) => r.ok)
    console.log(`\n${passed.length}/${rows.length} languages verified`)

    const failed = rows.filter((r) => !r.ok)
    if (failed.length > 0) {
        console.log('\nNot verified — these must NOT be offered in the picker:')
        for (const r of failed) console.log(`  · ${r.code} (${r.label})`)
        process.exitCode = 1
    }
    console.log()
}

main().catch((error) => {
    console.error('\nVerification crashed:', error)
    process.exitCode = 1
})
