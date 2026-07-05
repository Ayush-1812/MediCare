/**
 * Standalone Gemini Diagnostic Script
 * ────────────────────────────────────
 * Bypasses ALL application infrastructure:
 *   ✗ Authentication      ✗ AI Orchestrator
 *   ✗ Prisma / Database   ✗ Prompt Manager
 *   ✗ Intent Router       ✗ Context Builder
 *   ✗ Tool Registry       ✗ Streaming
 *
 * Directly calls @google/genai with a minimal prompt.
 * If this script fails with 403, the issue is EXTERNAL (Google Cloud / AI Studio).
 * If this script succeeds but the app fails, the issue is INTERNAL (code / config).
 *
 * Usage:
 *   npx ts-node scripts/test-gemini.ts
 *
 * Requires GEMINI_API_KEY in .env (auto-loaded via dotenv).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ── Manual .env loader (dotenv not guaranteed to be available) ───────────────
function loadEnv(): void {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) {
        console.warn('[test-gemini] .env not found at:', envPath);
        return;
    }
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
    console.log('[test-gemini] .env loaded from:', envPath);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
    loadEnv();

    console.log('');
    console.log('══════════════════════════════════════════════');
    console.log('  Gemini Standalone Diagnostic Script');
    console.log('══════════════════════════════════════════════');
    console.log('');

    // 1. Validate API Key presence
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
        console.error('❌ GEMINI_API_KEY is not set or empty.');
        console.error('   Set it in your .env file and retry.');
        process.exit(1);
    }

    console.log('✅ GEMINI_API_KEY:  Present');
    console.log(`   Key length:      ${apiKey.length} chars`);
    console.log(`   Key prefix:      ${apiKey.substring(0, 6)}...`);
    console.log('');

    // 2. Initialize SDK
    let GoogleGenAI: any;
    try {
        // Dynamic import to avoid ts-node module resolution issues
        const genai = await import('@google/genai');
        GoogleGenAI = genai.GoogleGenAI;
        console.log('✅ @google/genai SDK: Loaded successfully');
    } catch (e: any) {
        console.error('❌ Failed to load @google/genai SDK:', e.message);
        process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';

    console.log(`✅ Model:            ${model}`);
    console.log('');
    console.log('── Sending test prompt: "Hello" ──────────────');

    const startTime = Date.now();

    try {
        const response = await ai.models.generateContent({
            model,
            contents: 'Hello',
        });

        const latencyMs = Date.now() - startTime;
        const text = response.text;

        console.log('');
        console.log('══════════════════════════════════════════════');
        console.log('  RESULT: ✅ SUCCESS');
        console.log('══════════════════════════════════════════════');
        console.log(`  Model:      ${model}`);
        console.log(`  Latency:    ${latencyMs}ms`);
        console.log(`  Response:   "${text?.substring(0, 120)}${(text?.length ?? 0) > 120 ? '...' : ''}"`);
        console.log('══════════════════════════════════════════════');
        console.log('');
        console.log('✅ CONCLUSION: Gemini API is reachable and operational.');
        console.log('   The API key is valid and the project has access.');
        console.log('   Any 403 errors in the application are caused by app-level issues.');
        console.log('');

    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        const status = error?.status ?? error?.statusCode ?? 'N/A';
        const message = error?.message ?? 'Unknown error';
        const code = error?.code ?? 'N/A';

        console.log('');
        console.log('══════════════════════════════════════════════');
        console.log('  RESULT: ❌ FAILURE');
        console.log('══════════════════════════════════════════════');
        console.log(`  HTTP Status:      ${status}`);
        console.log(`  Error Code:       ${code}`);
        console.log(`  Error Message:    ${message}`);
        console.log(`  Latency:          ${latencyMs}ms`);
        console.log('══════════════════════════════════════════════');
        console.log('');

        if (status === 403) {
            console.log('❌ CONCLUSION: 403 PERMISSION_DENIED — EXTERNAL ISSUE');
            console.log('');
            console.log('   This script bypasses all application code.');
            console.log('   The failure is at the Google Cloud / AI Studio level.');
            console.log('');
            console.log('   Likely causes (in order of probability):');
            console.log('   1. Gemini API (Generative Language API) not enabled for this project');
            console.log('      → https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
            console.log('   2. API key restrictions set (IP/referrer allowlist)');
            console.log('      → https://console.cloud.google.com/apis/credentials');
            console.log('   3. Billing not configured (required in some regions)');
            console.log('      → https://console.cloud.google.com/billing');
            console.log('   4. Regional restriction (Gemini free tier unavailable in your region)');
            console.log('      → Try enabling billing or use a VPN to test');
            console.log('   5. Organization policy blocking external API access');
            console.log('      → Contact your GCP organization admin');
        } else if (status === 401) {
            console.log('❌ CONCLUSION: 401 UNAUTHORIZED — Invalid or revoked API key');
            console.log('   Generate a new key at https://aistudio.google.com/app/apikey');
        } else if (status === 429) {
            console.log('❌ CONCLUSION: 429 RATE_LIMIT — Quota exceeded, retry later');
        } else {
            console.log('❌ CONCLUSION: Unexpected error — see details above');
        }

        console.log('');
        process.exit(1);
    }
}

main();
