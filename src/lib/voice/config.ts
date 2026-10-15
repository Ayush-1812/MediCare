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
    { code: 'en-IN', label: 'English (India)', english: 'English', script: 'latin' },
    { code: 'hi-IN', label: 'हिन्दी', english: 'Hindi', script: 'devanagari' },
    { code: 'bn-IN', label: 'বাংলা', english: 'Bengali', script: 'bengali' },
    { code: 'ta-IN', label: 'தமிழ்', english: 'Tamil', script: 'tamil' },
    { code: 'te-IN', label: 'తెలుగు', english: 'Telugu', script: 'telugu' },
    { code: 'mr-IN', label: 'मराठी', english: 'Marathi', script: 'devanagari' },
    { code: 'gu-IN', label: 'ગુજરાતી', english: 'Gujarati', script: 'gujarati' },
    { code: 'kn-IN', label: 'ಕನ್ನಡ', english: 'Kannada', script: 'kannada' },
    { code: 'ml-IN', label: 'മലയാളം', english: 'Malayalam', script: 'malayalam' },
    { code: 'pa-IN', label: 'ਪੰਜਾਬੀ', english: 'Punjabi', script: 'gurmukhi' },
    { code: 'en-US', label: 'English (US)', english: 'English (US)', script: 'latin' },
] as const

/**
 * Every code above was verified against the live provider on 2026-10-15 by
 * `scripts/verify-voice-languages.js`: setup accepted, real audio returned, and the reply
 * transcript in the correct script. Nothing is listed here on the strength of the
 * provider's "70 languages" claim alone.
 *
 * Add a language only after that script passes for it. Offering an unverified language is
 * the specific failure mode of telling someone their language is supported when it is not.
 */
export const LANGUAGES_VERIFIED_ON = '2026-10-15'

/**
 * Writing system per language, used to guess the spoken language from a recognized
 * transcript.
 *
 * Note the deliberate limit: Hindi and Marathi share Devanagari, so script can never
 * distinguish them. Detection therefore proposes a switch only when the script does not
 * match the current selection at all, and the UI asks rather than switching silently.
 */
export const SCRIPT_PATTERNS: Record<string, RegExp> = {
    devanagari: /[ऀ-ॣ०-ॿ]/,
    bengali: /[ঀ-৿]/,
    gurmukhi: /[਀-੿]/,
    gujarati: /[઀-૿]/,
    tamil: /[஀-௿]/,
    telugu: /[ఀ-౿]/,
    kannada: /[ಀ-೿]/,
    malayalam: /[ഀ-ൿ]/,
    latin: /[A-Za-z]/,
}

/**
 * Majority script of `text`, or null when there is nothing to judge.
 *
 * The danda `।` (U+0964) and double danda (U+0965) sit inside the Devanagari block but
 * are shared sentence punctuation across Bengali, Gurmukhi, Gujarati and more — so the
 * Devanagari range above deliberately excludes them, and they are stripped here too.
 * Treating them as Devanagari misclassifies correct Bengali and Punjabi text, which is a
 * mistake this project has already made once, in the language verification script.
 */
export function detectScript(text: string): string | null {
    const cleaned = text
        .replace(/[।॥]/g, '')
        .replace(/[\s\d\p{P}\p{S}]/gu, '')
    if (!cleaned) return null

    let best: string | null = null
    let bestCount = 0
    for (const [name, pattern] of Object.entries(SCRIPT_PATTERNS)) {
        const count = (cleaned.match(new RegExp(pattern.source, 'gu')) || []).length
        if (count > bestCount) {
            best = name
            bestCount = count
        }
    }
    // Require a real majority. A single stray character in another script — a doctor's
    // name in Latin inside a Hindi sentence — must not trigger a language suggestion.
    return bestCount / cleaned.length >= 0.6 ? best : null
}

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
