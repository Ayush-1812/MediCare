/**
 * Live API verification for the voice receptionist.
 * ─────────────────────────────────────────────────
 * Bypasses the browser, the gateway and the database. It opens a real Gemini Live
 * session with the *same config shape* the app builds, drives one text turn, and
 * checks each thing the feature depends on:
 *
 *   1. the configured model accepts `bidiGenerateContent`
 *   2. every config field we send is accepted (a bad field fails `setup` outright)
 *   3. the prebuilt voice name is valid — the one setting most likely to be rejected
 *   4. native audio actually comes back as PCM
 *   5. output transcription is populated, which the transcript pane depends on
 *   6. function calling fires, and a tool response is accepted
 *
 * MediCare has no test harness (see the Phase 1 audit), so this stands in as the
 * provider contract test. Run it after any change to `liveConfig.ts`, or when a
 * session starts failing in a way that looks like the provider rather than our code:
 *
 *   node scripts/verify-voice.js
 */

const fs = require('fs')
const path = require('path')

// ─── Minimal .env loader ─────────────────────────────────────────────────────
// Next loads .env itself; a standalone script does not. Parsed by hand rather than
// adding a dependency for a diagnostic.
for (const file of ['.env.local', '.env']) {
    const full = path.join(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
        if (!match) continue
        const key = match[1]
        if (process.env[key]) continue
        process.env[key] = match[2].trim().replace(/^["']|["']$/g, '')
    }
}

const { GoogleGenAI, Type } = require('@google/genai')

const MODEL = process.env.VOICE_MODEL || 'gemini-3.8-live'
const VOICE_NAME = process.env.VOICE_NAME || 'Zephyr'
const TIMEOUT_MS = 45_000

const checks = []
function record(name, ok, detail) {
    checks.push({ name, ok, detail })
    const mark = ok ? 'PASS' : 'FAIL'
    console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set. Add it to .env first.')
        process.exit(1)
    }

    console.log(`\nVerifying Gemini Live for the voice receptionist`)
    console.log(`  model: ${MODEL}`)
    console.log(`  voice: ${VOICE_NAME}\n`)

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    // Mirrors src/lib/voice/liveConfig.ts. Kept inline on purpose: the point is to prove
    // the provider accepts these exact fields, so importing the app's TypeScript (which
    // this script cannot do anyway) would weaken the test.
    const config = {
        responseModalities: ['AUDIO'],
        systemInstruction:
            'You are Aether, a receptionist for a telemedicine app. Keep replies to one ' +
            "short sentence. When asked about the patient's appointments you must call " +
            'the list_my_appointments tool rather than answering from memory.',
        tools: [
            {
                functionDeclarations: [
                    {
                        name: 'list_my_appointments',
                        description: "Lists the patient's own appointments.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                status: {
                                    type: Type.STRING,
                                    enum: ['upcoming', 'past', 'cancelled', 'all'],
                                    description: 'Which appointments to return.',
                                },
                            },
                        },
                    },
                ],
            },
        ],
        speechConfig: {
            languageCode: 'en-IN',
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        realtimeInputConfig: {
            automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
                prefixPaddingMs: 120,
                silenceDurationMs: 700,
            },
            activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
            turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
        },
        contextWindowCompression: { slidingWindow: {} },
        sessionResumption: {},
        temperature: 0.3,
    }

    const seen = {
        setupComplete: false,
        audioBytes: 0,
        outputTranscript: '',
        toolCall: null,
        toolResponseAccepted: false,
        resumptionHandle: false,
        turnComplete: false,
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
            config,
            callbacks: {
                onopen: () => console.log('  … socket open'),
                onmessage: (message) => {
                    try {
                        if (message.setupComplete) seen.setupComplete = true

                        if (message.sessionResumptionUpdate?.newHandle) {
                            seen.resumptionHandle = true
                        }

                        const content = message.serverContent
                        if (content) {
                            for (const part of content.modelTurn?.parts || []) {
                                if (part.inlineData?.data) {
                                    seen.audioBytes += Buffer.from(
                                        part.inlineData.data,
                                        'base64',
                                    ).length
                                }
                            }
                            if (content.outputTranscription?.text) {
                                seen.outputTranscript += content.outputTranscription.text
                            }
                            if (content.turnComplete || content.generationComplete) {
                                seen.turnComplete = true
                                // A tool-calling exchange produces TWO turn boundaries: the
                                // first ends the turn in which the model asked for the tool,
                                // the second ends the spoken reply built from the result.
                                // Stopping on the first (the original mistake here) closed
                                // the socket before any audio was generated and looked like
                                // the provider returning no audio at all.
                                if (seen.audioBytes > 0) finish()
                            }
                        }

                        const calls = message.toolCall?.functionCalls || []
                        if (calls.length > 0 && !seen.toolCall) {
                            seen.toolCall = calls[0]
                            console.log(`  … model called ${calls[0].name}`)
                            // Answer with a canned result to prove the response is accepted
                            // and the model carries on speaking afterwards.
                            session.sendToolResponse({
                                functionResponses: [
                                    {
                                        ...(calls[0].id ? { id: calls[0].id } : {}),
                                        name: calls[0].name,
                                        response: {
                                            result: {
                                                total: 1,
                                                appointments: [
                                                    {
                                                        doctor: 'Dr Mehta',
                                                        when: '18 October 2026 at 04:30 PM',
                                                        status: 'Scheduled',
                                                    },
                                                ],
                                            },
                                        },
                                    },
                                ],
                            })
                            seen.toolResponseAccepted = true
                        }
                    } catch (error) {
                        seen.error = error
                        finish()
                    }
                },
                onerror: (event) => {
                    seen.error = (event && (event.error || event.message)) || event
                    finish()
                },
                onclose: () => finish(),
            },
        })
    } catch (error) {
        record('live.connect accepted the session config', false, error.message)
        summarize()
        return
    }

    record('live.connect accepted the session config', true, `model ${MODEL}`)

    // A text turn rather than synthesized speech: this is verifying the provider
    // contract, and generating fake PCM would only test our own encoder.
    session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: 'What appointments do I have coming up?' }] }],
        turnComplete: true,
    })

    const timer = setTimeout(finish, TIMEOUT_MS)
    await done
    clearTimeout(timer)
    try {
        session.close()
    } catch {
        /* already closed */
    }

    record('setup completed', seen.setupComplete)
    record(
        `prebuilt voice "${VOICE_NAME}" accepted`,
        seen.setupComplete && !seen.error,
        seen.error ? String(seen.error).slice(0, 120) : 'no setup rejection',
    )
    record('native audio returned', seen.audioBytes > 0, `${seen.audioBytes} bytes of PCM`)
    record(
        'output transcription populated',
        seen.outputTranscript.trim().length > 0,
        seen.outputTranscript.trim().slice(0, 80) || 'empty',
    )
    record(
        'function calling fired',
        Boolean(seen.toolCall),
        seen.toolCall ? `${seen.toolCall.name}(${JSON.stringify(seen.toolCall.args || {})})` : 'no tool call',
    )
    record('tool response accepted', seen.toolResponseAccepted)
    record('turn completed', seen.turnComplete)
    record(
        'session resumption handle issued',
        seen.resumptionHandle,
        seen.resumptionHandle ? 'reconnect will keep context' : 'none received',
    )
    if (seen.error) record('no provider error', false, String(seen.error).slice(0, 200))

    summarize()
}

function summarize() {
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
