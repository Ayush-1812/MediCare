import { NextResponse } from 'next/server';
import { GeminiService } from '@/lib/ai/services/geminiService';

/**
 * GET /api/health/gemini
 *
 * Diagnostic endpoint — verifies Gemini connectivity, measures latency,
 * and returns a structured result. No authentication required.
 *
 * Never exposes API keys, user data, or conversation history.
 * Safe to call from a monitoring dashboard or CI health check.
 */
export async function GET() {
    try {
        const service = GeminiService.getInstance();
        const result = await service.healthCheck();

        if (result.success) {
            return NextResponse.json(
                {
                    success: true,
                    model: result.model,
                    provider: result.provider,
                    sdk: result.sdk,
                    latencyMs: result.latencyMs,
                    timestamp: result.timestamp,
                },
                { status: 200 }
            );
        } else {
            return NextResponse.json(
                {
                    success: false,
                    model: result.model,
                    provider: result.provider,
                    sdk: result.sdk,
                    latencyMs: result.latencyMs,
                    timestamp: result.timestamp,
                    errorCode: result.errorCode,
                    classification: result.classification,
                    providerMessage: result.providerMessage,
                },
                { status: 503 }
            );
        }
    } catch (error: any) {
        // Catches initialization errors (e.g. missing GEMINI_API_KEY)
        console.error('[GET /api/health/gemini] Initialization error:', error.message);
        return NextResponse.json(
            {
                success: false,
                model: 'unknown',
                provider: 'Google Gemini',
                timestamp: new Date().toISOString(),
                errorCode: 'INIT_FAILURE',
                classification: 'INITIALIZATION_ERROR',
                providerMessage: error.message,
            },
            { status: 503 }
        );
    }
}
