import { GoogleGenAI, type Schema } from '@google/genai';
import { PromptPackage } from '../promptManager/types';
import {
    GEMINI_MODEL,
    GEMINI_SDK,
    GEMINI_PROVIDER,
    GEMINI_TIMEOUT_MS,
    GEMINI_MAX_RETRIES,
    GEMINI_RETRY_BASE_DELAY_MS,
} from '../config/geminiConfig';

// ─── Internal Types ──────────────────────────────────────────────────────────

interface GeminiDiagnostics {
    sdk: string;
    model: string;
    timestamp: string;
    promptSizeChars: number;
    estimatedTokens: number;
    latencyMs?: number;
    httpStatus?: number | string;
    providerMessage?: string;
    providerErrorCode?: string;
    classification?: string;
}

export interface HealthCheckResult {
    success: boolean;
    model: string;
    provider: string;
    sdk: string;
    latencyMs?: number;
    timestamp: string;
    errorCode?: string;
    classification?: string;
    providerMessage?: string;
}

// ─── Error Classification ────────────────────────────────────────────────────

/**
 * Maps HTTP status codes and provider message text to a structured classification.
 * 403 is intentionally split into sub-categories to avoid misleading "invalid key" messages.
 */
function classifyGeminiError(status: number | undefined, message: string): {
    userMessage: string;
    classification: string;
} {
    if (status === 401) {
        return {
            userMessage: 'The Gemini API key is invalid or has been revoked.',
            classification: 'INVALID_API_KEY',
        };
    }

    if (status === 403) {
        const msg = message.toLowerCase();

        if (msg.includes('project') && (msg.includes('denied') || msg.includes('permission'))) {
            return {
                userMessage: 'Your Google Cloud project has been denied access to the Gemini API. Check project permissions and API enablement in Google Cloud Console.',
                classification: 'PROJECT_DENIED',
            };
        }
        if (msg.includes('api') && msg.includes('not enabled')) {
            return {
                userMessage: 'The Generative Language API is not enabled for this project. Enable it in Google Cloud Console.',
                classification: 'API_NOT_ENABLED',
            };
        }
        if (msg.includes('billing')) {
            return {
                userMessage: 'A billing restriction is preventing access to the Gemini API. Check billing configuration in Google Cloud Console.',
                classification: 'BILLING_RESTRICTION',
            };
        }
        if (msg.includes('region') || msg.includes('location') || msg.includes('country')) {
            return {
                userMessage: 'The Gemini API is not available in your current region.',
                classification: 'REGIONAL_RESTRICTION',
            };
        }

        return {
            userMessage: 'Access to the Gemini API was denied. Possible causes: project permissions, API not enabled, billing restriction, or regional restriction.',
            classification: 'PERMISSION_DENIED',
        };
    }

    if (status === 404) {
        return {
            userMessage: `Gemini model '${GEMINI_MODEL}' is unavailable or not found.`,
            classification: 'MODEL_UNAVAILABLE',
        };
    }

    if (status === 429) {
        return {
            userMessage: 'Rate limit or quota exceeded. Please try again later.',
            classification: 'QUOTA_EXCEEDED',
        };
    }

    if (status === 408) {
        return {
            userMessage: 'The request to Gemini timed out. Please try again.',
            classification: 'TIMEOUT',
        };
    }

    if (status && status >= 500) {
        return {
            userMessage: 'The Gemini service is temporarily unavailable. Please try again in a few minutes.',
            classification: 'PROVIDER_UNAVAILABLE',
        };
    }

    return {
        userMessage: 'An unexpected error occurred while communicating with the AI provider.',
        classification: 'UNKNOWN_ERROR',
    };
}

// ─── Structured Diagnostics Logger ──────────────────────────────────────────

/**
 * Logs provider diagnostics to the server console.
 * NEVER logs: API keys, medical information, conversation history, or user identifiers.
 */
function logDiagnostics(label: string, d: GeminiDiagnostics): void {
    console.log(`[GeminiService][${label}] {`);
    console.log(`  sdk:             ${d.sdk}`);
    console.log(`  model:           ${d.model}`);
    console.log(`  timestamp:       ${d.timestamp}`);
    console.log(`  promptSizeChars: ${d.promptSizeChars}`);
    console.log(`  estimatedTokens: ${d.estimatedTokens}`);
    if (d.latencyMs !== undefined)     console.log(`  latencyMs:       ${d.latencyMs}`);
    if (d.httpStatus !== undefined)    console.log(`  httpStatus:      ${d.httpStatus}`);
    if (d.classification !== undefined) console.log(`  classification:  ${d.classification}`);
    if (d.providerMessage !== undefined) console.log(`  providerMessage: ${d.providerMessage}`);
    if (d.providerErrorCode !== undefined) console.log(`  providerErrCode: ${d.providerErrorCode}`);
    console.log(`}`);
}

// ─── Retry Utility ───────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Returns true for errors that are worth retrying (transient server-side or rate-limit). */
function isRetryable(status: number | undefined): boolean {
    if (!status) return false;
    return status === 429 || status >= 500;
}

// ─── GeminiService ───────────────────────────────────────────────────────────

export class GeminiService {
    private static instance: GeminiService;
    private ai: GoogleGenAI;

    private constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey.trim() === '') {
            throw new Error(
                '[GeminiService] FATAL: GEMINI_API_KEY is missing or empty. ' +
                'Set it in .env before starting the server.'
            );
        }
        // Single GoogleGenAI client — reused for all requests via singleton
        this.ai = new GoogleGenAI({ apiKey });
    }

    /** Returns the singleton instance. Thread-safe in Node.js (single-threaded event loop). */
    public static getInstance(): GeminiService {
        if (!GeminiService.instance) {
            GeminiService.instance = new GeminiService();
        }
        return GeminiService.instance;
    }

    // ── Public: Health Check ─────────────────────────────────────────────────

    /**
     * Sends a minimal "Hello" prompt to Gemini and measures latency.
     * Returns a structured HealthCheckResult. Never throws — always returns a result.
     */
    public async healthCheck(): Promise<HealthCheckResult> {
        const timestamp = new Date().toISOString();
        const startTime = Date.now();

        const baseDiagnostics: Omit<GeminiDiagnostics, 'latencyMs'> = {
            sdk: GEMINI_SDK,
            model: GEMINI_MODEL,
            timestamp,
            promptSizeChars: 5, // "Hello"
            estimatedTokens: 2,
        };

        console.log('[GeminiService][healthCheck] Initiating connectivity check...');

        try {
            const response = await this.ai.models.generateContent({
                model: GEMINI_MODEL,
                contents: 'Hello',
            });

            const latencyMs = Date.now() - startTime;
            const success = !!response.text;

            logDiagnostics('healthCheck:SUCCESS', {
                ...baseDiagnostics,
                latencyMs,
                httpStatus: 200,
                classification: success ? 'OK' : 'EMPTY_RESPONSE',
            });

            return {
                success,
                model: GEMINI_MODEL,
                provider: GEMINI_PROVIDER,
                sdk: GEMINI_SDK,
                latencyMs,
                timestamp,
            };
        } catch (error: any) {
            const latencyMs = Date.now() - startTime;
            const status = error?.status ?? error?.statusCode;
            const message = error?.message ?? 'Unknown error';
            const { classification } = classifyGeminiError(status, message);

            logDiagnostics('healthCheck:FAILURE', {
                ...baseDiagnostics,
                latencyMs,
                httpStatus: status,
                providerMessage: message,
                providerErrorCode: error?.code ?? String(status),
                classification,
            });

            return {
                success: false,
                model: GEMINI_MODEL,
                provider: GEMINI_PROVIDER,
                sdk: GEMINI_SDK,
                latencyMs,
                timestamp,
                errorCode: String(status ?? 'UNKNOWN'),
                classification,
                // Sanitized — no raw internal error details exposed
                providerMessage: message.replace(/key[=:]\S+/gi, 'key=[REDACTED]'),
            };
        }
    }

    // ── Public: Generate Response ────────────────────────────────────────────

    /**
     * Generates an AI response for the given prompt package.
     * Includes retry logic for transient errors and a timeout guard.
     * Never throws — returns a user-friendly error string on failure.
     */
    public async generateResponse(promptPackage: PromptPackage): Promise<string> {
        const prompt =
            `${promptPackage.systemPrompt}\n\n` +
            `${promptPackage.intentPrompts}\n\n` +
            `### PATIENT CONTEXT\n${JSON.stringify(promptPackage.context.data, null, 2)}\n\n` +
            `### USER QUESTION\n${promptPackage.userQuestion}`;

        const promptSizeChars = prompt.length;
        const estimatedTokens = Math.ceil(promptSizeChars / 4);
        const timestamp = new Date().toISOString();

        const baseDiagnostics: Omit<GeminiDiagnostics, 'latencyMs'> = {
            sdk: GEMINI_SDK,
            model: GEMINI_MODEL,
            timestamp,
            promptSizeChars,
            estimatedTokens,
        };

        console.log(`[GeminiService] Starting request | model=${GEMINI_MODEL} | ~${estimatedTokens} tokens`);

        let lastError: any = null;

        for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                const delay = GEMINI_RETRY_BASE_DELAY_MS * attempt;
                console.log(`[GeminiService] Retry ${attempt}/${GEMINI_MAX_RETRIES} after ${delay}ms...`);
                await sleep(delay);
            }

            const startTime = Date.now();

            try {
                // Timeout guard via AbortController
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

                let fullResponse = '';

                try {
                    const responseStream = await this.ai.models.generateContentStream({
                        model: GEMINI_MODEL,
                        contents: prompt,
                        // Without passing the signal the AbortController below was inert:
                        // a request that hung before the first chunk arrived was never
                        // actually cancelled, and the timeout only took effect once the
                        // stream started producing data.
                        config: { abortSignal: controller.signal },
                    });

                    for await (const chunk of responseStream) {
                        if (controller.signal.aborted) break;
                        if (chunk.text) fullResponse += chunk.text;
                    }
                } finally {
                    clearTimeout(timeoutId);
                }

                if (controller.signal.aborted) {
                    throw Object.assign(new Error('Request timed out after ' + GEMINI_TIMEOUT_MS + 'ms'), { status: 408 });
                }

                const latencyMs = Date.now() - startTime;
                logDiagnostics('generateResponse:SUCCESS', {
                    ...baseDiagnostics,
                    latencyMs,
                    httpStatus: 200,
                    classification: 'OK',
                });

                return fullResponse || "I'm sorry, I couldn't generate a response at this time. Please try again.";

            } catch (error: any) {
                lastError = error;
                const latencyMs = Date.now() - startTime;
                const status = error?.status ?? error?.statusCode;
                const message = error?.message ?? 'Unknown error';
                const { classification } = classifyGeminiError(status, message);

                logDiagnostics(`generateResponse:ERROR(attempt=${attempt})`, {
                    ...baseDiagnostics,
                    latencyMs,
                    httpStatus: status,
                    providerMessage: message,
                    providerErrorCode: error?.code ?? String(status),
                    classification,
                });

                // Only retry transient errors
                if (!isRetryable(status) || attempt >= GEMINI_MAX_RETRIES) {
                    break;
                }
            }
        }

        // All attempts exhausted — return user-friendly message
        const status = lastError?.status ?? lastError?.statusCode;
        const message = lastError?.message ?? 'Unknown error';
        const { userMessage } = classifyGeminiError(status, message);
        return userMessage;
    }

    // ── Public: Structured (JSON) Generation ─────────────────────────────────

    /**
     * Runs a prompt that must come back as JSON matching `responseSchema`.
     *
     * Unlike `generateResponse`, this THROWS on failure rather than returning a friendly
     * string — callers that need structured data have to be able to tell a real result
     * apart from an error message, and fall back to their own non-AI path.
     */
    public async generateStructured<T>(options: {
        systemInstruction: string;
        prompt: string;
        responseSchema: Schema;
        /** Defaults to 0 — this is extraction, not creative writing. */
        temperature?: number;
        maxOutputTokens?: number;
        label?: string;
    }): Promise<T> {
        const label = options.label ?? 'generateStructured';
        const promptSizeChars = options.systemInstruction.length + options.prompt.length;
        const baseDiagnostics: Omit<GeminiDiagnostics, 'latencyMs'> = {
            sdk: GEMINI_SDK,
            model: GEMINI_MODEL,
            timestamp: new Date().toISOString(),
            promptSizeChars,
            estimatedTokens: Math.ceil(promptSizeChars / 4),
        };

        let lastError: any = null;

        for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
            if (attempt > 0) await sleep(GEMINI_RETRY_BASE_DELAY_MS * attempt);

            const startTime = Date.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

            try {
                const response = await this.ai.models.generateContent({
                    model: GEMINI_MODEL,
                    contents: options.prompt,
                    config: {
                        systemInstruction: options.systemInstruction,
                        responseMimeType: 'application/json',
                        responseSchema: options.responseSchema,
                        temperature: options.temperature ?? 0,
                        maxOutputTokens: options.maxOutputTokens ?? 2048,
                        abortSignal: controller.signal,
                    },
                });

                const text = response.text;
                if (!text) throw new Error('Provider returned an empty response');

                const parsed = JSON.parse(text) as T;

                logDiagnostics(`${label}:SUCCESS`, {
                    ...baseDiagnostics,
                    latencyMs: Date.now() - startTime,
                    httpStatus: 200,
                    classification: 'OK',
                });
                return parsed;
            } catch (error: any) {
                lastError = error;
                const status = error?.status ?? error?.statusCode;
                const { classification } = classifyGeminiError(status, error?.message ?? '');

                logDiagnostics(`${label}:ERROR(attempt=${attempt})`, {
                    ...baseDiagnostics,
                    latencyMs: Date.now() - startTime,
                    httpStatus: status,
                    providerMessage: error?.message,
                    classification,
                });

                // A malformed JSON body is worth one more try; 4xx never is.
                const retryable = isRetryable(status) || error instanceof SyntaxError;
                if (!retryable || attempt >= GEMINI_MAX_RETRIES) break;
            } finally {
                clearTimeout(timeoutId);
            }
        }

        const { userMessage } = classifyGeminiError(
            lastError?.status ?? lastError?.statusCode,
            lastError?.message ?? '',
        );
        throw new Error(userMessage);
    }
}
