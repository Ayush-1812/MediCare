/**
 * Builds the `LiveConnectConfig` for a session.
 *
 * This lives on the TypeScript side and is handed to the CommonJS gateway as plain JSON,
 * which works because every enum in the Live API is a string enum — `Modality.AUDIO` is
 * the string `"AUDIO"`. Keeping it here means the gateway holds no configuration of its
 * own to drift out of step with the app.
 *
 * Field names were taken from the installed SDK typings, not from documentation that may
 * describe a different version.
 */

import {
    VOICE_NAME,
    type LanguageCode,
} from './config'
import { VOICE_TOOLS } from './tools/definitions'
import {
    buildSystemInstruction,
    type VoicePatientContext,
    type VoiceTimeContext,
} from './prompt'

export type LiveSessionConfig = Record<string, unknown>

export function buildLiveConfig(
    patient: VoicePatientContext,
    language: LanguageCode,
    time: VoiceTimeContext,
    options: { includeVoice?: boolean } = {},
): LiveSessionConfig {
    const includeVoice = options.includeVoice !== false

    return {
        // Native audio out. Text is delivered separately as a transcript, which is why
        // AUDIO alone is correct here rather than both modalities — asking for both is
        // rejected by the Live API.
        responseModalities: ['AUDIO'],

        systemInstruction: buildSystemInstruction(patient, language, time),

        tools: [{ functionDeclarations: VOICE_TOOLS }],

        speechConfig: {
            languageCode: language,
            // Omitted on the retry path: prebuilt voice names are a fixed Google-side set,
            // and an unrecognised one fails `setup` outright. Better to fall back to the
            // model's default voice than to hand the user a dead session.
            ...(includeVoice
                ? { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } }
                : {}),
        },

        // Both directions transcribed: the input transcript drives the live caption and
        // the output transcript is what the transcript pane and any future audit log
        // record. Native-audio models emit audio only, so without this there is no text
        // at all.
        inputAudioTranscription: {},
        outputAudioTranscription: {},

        realtimeInputConfig: {
            automaticActivityDetection: {
                // Provider-side VAD. Running our own would mean shipping audio we have
                // already decided is silence, or worse, clipping the start of a word.
                disabled: false,
                startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
                // A little lead-in so the first consonant is not clipped.
                prefixPaddingMs: 120,
                /**
                 * How long the provider waits after speech stops before deciding the turn
                 * ended. This is pure dead air on EVERY spoken turn, added before the model
                 * even begins — and unlike model latency it is entirely ours to choose.
                 *
                 * Was 700ms, reasoning that medical conversations contain real pauses while
                 * someone recalls a medicine name. True, but 700ms is felt as hesitation on
                 * every single reply, and the cost is paid constantly to protect against an
                 * occasional mid-sentence pause. 450ms still clears a breath or a short
                 * hesitation while removing a quarter-second from every turn.
                 *
                 * Lower than ~350ms starts cutting people off mid-thought, which is far
                 * worse than a slightly slow reply — so this is the floor, not a dial to
                 * keep turning.
                 */
                silenceDurationMs: 450,
            },
            // The entire point of barge-in: the moment the patient starts speaking, the
            // model's turn is cancelled rather than queued behind it.
            activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
            turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
        },

        // Lifts the 15-minute audio-only session cap by compressing older context instead
        // of letting the connection expire mid-conversation.
        contextWindowCompression: { slidingWindow: {} },

        // Asks the server for resumption handles so a dropped connection can be rejoined
        // with context intact. `null` here means "start a new session"; the gateway
        // substitutes a stored handle when reconnecting.
        sessionResumption: {},

        // Grounded reception work, not creative writing. Low but not zero: some phrasing
        // variation keeps the voice from sounding canned, and this mirrors the temperature
        // the text assistant already settled on in geminiService.
        temperature: 0.3,
    }
}
