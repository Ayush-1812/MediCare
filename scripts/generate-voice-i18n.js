/**
 * Generates the voice receptionist's interface translations.
 * ──────────────────────────────────────────────────────────
 * Reads the English source catalog from `src/lib/voice/messages.ts` and writes
 * `src/lib/voice/i18n.generated.ts` — static data, committed, so nothing is translated
 * at runtime.
 *
 * Why generate rather than hand-write: the app offers ten Indian languages, and strings
 * invented by someone who does not read Kannada are worse than useless — they look
 * finished. Generating them with the same provider that speaks them, then recording in
 * the output that they are model-authored and awaiting native review, is honest about
 * what they are. Review replaces them in place; the file is ordinary source.
 *
 * Usage:  node scripts/generate-voice-i18n.js
 *         node scripts/generate-voice-i18n.js hi-IN       (regenerate one language)
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

const { GoogleGenAI, Type } = require('@google/genai')

const MODEL = 'gemini-2.5-flash'
const SOURCE = path.join(process.cwd(), 'src/lib/voice/messages.ts')
const OUTPUT = path.join(process.cwd(), 'src/lib/voice/i18n.generated.ts')

const TARGETS = [
    { code: 'hi-IN', name: 'Hindi', script: 'Devanagari' },
    { code: 'bn-IN', name: 'Bengali', script: 'Bengali' },
    { code: 'ta-IN', name: 'Tamil', script: 'Tamil' },
    { code: 'te-IN', name: 'Telugu', script: 'Telugu' },
    { code: 'mr-IN', name: 'Marathi', script: 'Devanagari' },
    { code: 'gu-IN', name: 'Gujarati', script: 'Gujarati' },
    { code: 'kn-IN', name: 'Kannada', script: 'Kannada' },
    { code: 'ml-IN', name: 'Malayalam', script: 'Malayalam' },
    { code: 'pa-IN', name: 'Punjabi', script: 'Gurmukhi' },
]

/**
 * Parses the source catalog out of `messages.ts`.
 *
 * Read with a regex rather than imported: this is a plain CommonJS script and the source
 * is TypeScript. The file is deliberately a flat object of string literals, which is what
 * makes this safe — see the note in messages.ts about keeping keys flat.
 */
function readSourceMessages() {
    const text = fs.readFileSync(SOURCE, 'utf8')
    const body = text.slice(text.indexOf('export const MESSAGES = {'))
    const messages = {}

    // Key, then a single- or double-quoted value, possibly spread over lines via
    // concatenation. Captures the whole right-hand side up to the line-ending comma.
    const pattern = /^\s{4}([a-z_]+):\s*((?:'[^']*'|"[^"]*")(?:\s*\+\s*(?:'[^']*'|"[^"]*"))*),$/gm
    let match
    while ((match = pattern.exec(body)) !== null) {
        const literal = match[2]
            .split(/\s*\+\s*/)
            .map((piece) => piece.slice(1, -1))
            .join('')
        messages[match[1]] = literal
    }
    return messages
}

async function translate(ai, messages, target) {
    const keys = Object.keys(messages)

    const schema = {
        type: Type.OBJECT,
        properties: Object.fromEntries(keys.map((key) => [key, { type: Type.STRING }])),
        required: keys,
    }

    const instruction =
        `You are localizing the interface of a telemedicine voice assistant into ${target.name}, ` +
        `written in the ${target.script} script.\n\n` +
        'Rules:\n' +
        `- Write natural ${target.name} as spoken in India, not a literal word-for-word rendering.\n` +
        '- "Aether" is a product name: leave it exactly as "Aether", untranslated and untransliterated.\n' +
        '- Keep the placeholder {language} exactly as written, including the braces.\n' +
        '- Keep these as recognisable loanwords if that is how people actually say them in ' +
        `${target.name}: appointment, doctor, prescription, microphone.\n` +
        '- Match the register: calm, plain, respectful. This is healthcare, not marketing.\n' +
        '- Keep button labels short enough for a button. Error messages may be a full sentence.\n' +
        '- Preserve typographic quotes and the ellipsis character where the source has them.\n' +
        '- Do not add explanations, romanisation, or alternative translations.'

    const prompt =
        'Translate every value in this JSON object. Return the same keys with translated values.\n\n' +
        JSON.stringify(messages, null, 2)

    const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
            systemInstruction: instruction,
            responseMimeType: 'application/json',
            responseSchema: schema,
            // Zero: this is localization, not writing. Variation between runs would make
            // the committed file churn for no reason.
            temperature: 0,
            maxOutputTokens: 8192,
        },
    })

    const text = response.text
    if (!text) throw new Error('empty response')
    return JSON.parse(text)
}

/** Quotes a string as a TypeScript single-quoted literal. */
function literal(value) {
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
}

async function main() {
    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set.')
        process.exit(1)
    }

    const messages = readSourceMessages()
    const keys = Object.keys(messages)
    if (keys.length === 0) {
        console.error('Parsed no messages from messages.ts — check the source format.')
        process.exit(1)
    }
    console.log(`\nSource catalog: ${keys.length} strings`)

    const only = process.argv.slice(2)
    const targets = only.length > 0 ? TARGETS.filter((t) => only.includes(t.code)) : TARGETS

    // Preserve languages we are not regenerating, so a single-language run is not a
    // destructive rewrite of the whole file.
    const existing = {}
    if (fs.existsSync(OUTPUT) && only.length > 0) {
        const text = fs.readFileSync(OUTPUT, 'utf8')
        for (const t of TARGETS) {
            if (only.includes(t.code)) continue
            const block = new RegExp(`'${t.code}': \\{([\\s\\S]*?)\\n {4}\\}`, 'm').exec(text)
            if (block) existing[t.code] = block[1]
        }
    }

    const results = {}
    for (const target of targets) {
        process.stdout.write(`  ${target.code.padEnd(7)} ${target.name.padEnd(11)} `)
        try {
            const translated = await translate(ai, messages, target)
            const missing = keys.filter((k) => !translated[k] || !String(translated[k]).trim())
            if (missing.length > 0) {
                console.log(`PARTIAL — missing ${missing.length}: ${missing.slice(0, 4).join(', ')}`)
            } else {
                console.log('OK')
            }
            results[target.code] = translated
        } catch (error) {
            console.log(`FAIL — ${error.message}`)
        }
    }

    const header = `/**
 * GENERATED FILE — do not edit by hand except to correct a translation.
 *
 * Produced by \`node scripts/generate-voice-i18n.js\` from the English source catalog in
 * \`messages.ts\`. Regenerate after changing any source string.
 *
 * Provenance: these translations are model-authored (${MODEL}) and have NOT been reviewed
 * by native speakers. They are committed as static data rather than translated at
 * runtime. Treat a correction from a speaker of the language as authoritative over this
 * file and edit the value in place — it is ordinary source, and nothing regenerates it
 * automatically.
 *
 * Generated: ${new Date().toISOString().slice(0, 10)}
 */

import type { MessageCatalog } from './messages'

export const GENERATED_CATALOGS: Partial<Record<string, Partial<MessageCatalog>>> = {
`

    const blocks = []
    for (const target of TARGETS) {
        if (results[target.code]) {
            const lines = keys
                .filter((key) => results[target.code][key])
                .map((key) => `        ${key}: ${literal(results[target.code][key])},`)
            blocks.push(`    // ${target.name} (${target.script})\n    '${target.code}': {\n${lines.join('\n')}\n    }`)
        } else if (existing[target.code]) {
            blocks.push(`    '${target.code}': {${existing[target.code]}\n    }`)
        }
    }

    fs.writeFileSync(OUTPUT, `${header}${blocks.join(',\n')},\n}\n`, 'utf8')
    console.log(`\nWrote ${OUTPUT}`)
    console.log(`${blocks.length} language catalogs\n`)
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
main().catch((error) => {
    console.error('\nGeneration failed:', error)
    process.exitCode = 1
})
