/**
 * Centralized Gemini provider configuration.
 * All GeminiService settings are defined here — never scattered across files.
 */

/** The Gemini model to use for all AI responses. */
export const GEMINI_MODEL = 'gemini-2.5-flash';

/** SDK identifier for diagnostics logging. */
export const GEMINI_SDK = '@google/genai@2.10.0';

/** Provider display name for health check responses. */
export const GEMINI_PROVIDER = 'Google Gemini';

/**
 * Maximum time (ms) to wait for a Gemini response before aborting.
 * Prevents indefinite hangs in production.
 */
export const GEMINI_TIMEOUT_MS = 30_000;

/**
 * Number of retry attempts for transient errors (5xx, 429).
 * Does NOT retry 4xx errors — those are permanent until user action.
 */
export const GEMINI_MAX_RETRIES = 2;

/**
 * Base delay (ms) for exponential backoff between retries.
 * Retry 1 = 500ms, Retry 2 = 1000ms.
 */
export const GEMINI_RETRY_BASE_DELAY_MS = 500;
