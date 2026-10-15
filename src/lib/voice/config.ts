/**
 * Gemini Live configuration for the MediCare voice receptionist.
 *
 * Every value here was verified against the installed SDK typings
 * (`node_modules/@google/genai/dist/genai.d.ts`, v2.10.0) and a live `ListModels` query
 * against this project's key — not from memory. Third-party write-ups disagree on the
 * current Live model id, so the account was asked directly.
 *
 * This module is imported by both the Next app (TypeScript) and, through its compiled
 * mirror, the CommonJS gateway. Keep it free of framework imports and side effects.
 */

/**
 * `gemini-3.8-live` — the generally available Live model on this account.
 * `supportedGenerationMethods: ["bidiGenerateContent"]`, 131,072 in / 65,536 out.
 *
 * Overridable because Google rotates Live model ids faster than anything else in the
 * API, and a hard-coded id is the first thing to rot.
 */
export const VOICE_MODEL = process.env.VOICE_MODEL || 'gemini-3.8-live'

/** Documented Live API wire formats. Both are raw little-endian PCM16, mono. */
export const INPUT_SAMPLE_RATE = 16_000
export const OUTPUT_SAMPLE_RATE = 24_000
export const INPUT_MIME_TYPE = `audio/pcm;rate=${INPUT_SAMPLE_RATE}`

/**
 * 20 ms of capture per frame (320 samples @16 kHz). Small enough that barge-in feels
 * immediate, large enough that we are not paying socket overhead per millisecond.
 */
export const CAPTURE_FRAME_SAMPLES = 320

/**
 * The synthesized voice. Prebuilt Live voices are a fixed Google-side set, so an
 * unrecognised name makes `setup` fail — the gateway therefore retries once without any
 * `voiceConfig` and lets the model use its default rather than leaving the caller with a
 * dead session. See `buildLiveConfig`.
 */
export const VOICE_NAME = process.env.VOICE_NAME || 'Zephyr'

/**
 * Languages offered in the UI. The model itself covers ~70 and detects the spoken
 * language on its own; this list only drives the picker and the initial `languageCode`.
 *
 * Indian languages lead the list deliberately: this app bills in INR through Razorpay
 * and searches pharmacies via an India-centric provider, so its users are the ones who
 * will speak to it. Mixed Hindi/English in a single sentence is the expected input, and
 * is precisely what the native-audio path handles and an STT pipeline does not.
 */
export const SUPPORTED_LANGUAGES = [
    { code: 'en-IN', label: 'English (India)' },
    { code: 'hi-IN', label: 'हिन्दी' },
    { code: 'bn-IN', label: 'বাংলা' },
    { code: 'ta-IN', label: 'தமிழ்' },
    { code: 'te-IN', label: 'తెలుగు' },
    { code: 'mr-IN', label: 'मराठी' },
    { code: 'gu-IN', label: 'ગુજરાતી' },
    { code: 'kn-IN', label: 'ಕನ್ನಡ' },
    { code: 'ml-IN', label: 'മലയാളം' },
    { code: 'pa-IN', label: 'ਪੰਜਾਬੀ' },
    { code: 'en-US', label: 'English (US)' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']
export const DEFAULT_LANGUAGE: LanguageCode = 'en-IN'

export function isSupportedLanguage(value: unknown): value is LanguageCode {
    return SUPPORTED_LANGUAGES.some((l) => l.code === value)
}

/** Cap on how long one voice session may live, independent of provider limits. */
export const SESSION_MAX_MS = 30 * 60 * 1000

/**
 * How long a resumption handle is kept for a dropped socket before the session is torn
 * down for good. Google keeps handles valid for 2 h; we are far stricter because a
 * half-finished booking conversation should not be resumable an hour later.
 */
export const RESUME_GRACE_MS = 2 * 60 * 1000

/** Internal tool-execution endpoint the gateway calls inside Next. */
export const TOOL_ENDPOINT_PATH = '/api/voice/tool'

/** Per-tool wall clock. A tool that outlives this returns an error to the model. */
export const TOOL_TIMEOUT_MS = 10_000
