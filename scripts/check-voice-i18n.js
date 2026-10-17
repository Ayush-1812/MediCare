/**
 * Reports interface-localization coverage for the voice receptionist.
 * ───────────────────────────────────────────────────────────────────
 * Mirrors `localizationCoverage()` in `src/lib/voice/i18n.ts`, but as a standalone check
 * so it can run in CI without a TypeScript toolchain.
 *
 * A key counts as translated only when its value differs from the English source. That
 * matters: a generator that echoed English back has translated nothing, and counting it
 * as covered would turn this check into exactly the false reassurance it exists to
 * prevent. `title` is the product name "Aether" and is identical by instruction, so it is
 * excluded from that rule.
 *
 * Exits non-zero if any language the picker offers falls below the threshold, so a
 * half-generated catalog cannot ship looking finished.
 *
 *   node scripts/check-voice-i18n.js
 */

const fs = require('fs')
const path = require('path')

const THRESHOLD = 0.9

const SOURCE = path.join(process.cwd(), 'src/lib/voice/messages.ts')
const GENERATED = path.join(process.cwd(), 'src/lib/voice/i18n.generated.ts')

const LANGUAGES = [
    ['hi-IN', 'Hindi'],
    ['bn-IN', 'Bengali'],
    ['ta-IN', 'Tamil'],
    ['te-IN', 'Telugu'],
    ['mr-IN', 'Marathi'],
    ['gu-IN', 'Gujarati'],
    ['kn-IN', 'Kannada'],
    ['ml-IN', 'Malayalam'],
    ['pa-IN', 'Punjabi'],
]

/**
 * Reads the flat `key: 'value'` pairs out of a source file section.
 *
 * `\s*` after the colon is required, not cosmetic: several source strings are long enough
 * that the value begins on the following line, and matching only same-line pairs silently
 * dropped four of them — under-reporting the denominator AND never checking those keys,
 * which is the one failure mode this script exists to catch.
 */
function readPairs(text, indent) {
    const pairs = {}
    const pattern = new RegExp(
        `^ {${indent}}([a-z_]+):\\s*((?:'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")(?:\\s*\\+\\s*(?:'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*"))*),$`,
        'gm',
    )
    let match
    while ((match = pattern.exec(text)) !== null) {
        pairs[match[1]] = match[2]
            .split(/\s*\+\s*/)
            .map((piece) => piece.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\'))
            .join('')
    }
    return pairs
}

function main() {
    const source = fs.readFileSync(SOURCE, 'utf8')
    const english = readPairs(source.slice(source.indexOf('export const MESSAGES = {')), 4)
    const keys = Object.keys(english)

    if (keys.length === 0) {
        console.error('Parsed no strings from messages.ts — check its format.')
        process.exit(1)
    }

    if (!fs.existsSync(GENERATED)) {
        console.error('i18n.generated.ts is missing. Run: node scripts/generate-voice-i18n.js')
        process.exit(1)
    }
    const generated = fs.readFileSync(GENERATED, 'utf8')

    console.log(`\nVoice interface localization — ${keys.length} source strings\n`)
    console.log(`  en-IN  100%  English (source)`)
    console.log(`  en-US  100%  English (source)`)

    const failures = []

    for (const [code, name] of LANGUAGES) {
        const block = new RegExp(`'${code}': \\{([\\s\\S]*?)\\n {4}\\}`).exec(generated)
        if (!block) {
            console.log(`  ${code}    0%  ${name} — NO CATALOG`)
            failures.push(`${code} (${name}): no catalog`)
            continue
        }

        const catalog = readPairs(block[1], 8)
        const missing = keys.filter((key) => !catalog[key])
        const identical = keys.filter(
            (key) => key !== 'title' && catalog[key] && catalog[key] === english[key],
        )
        const translated = keys.length - missing.length - identical.length
        const coverage = translated / keys.length

        const notes = []
        if (missing.length > 0) notes.push(`${missing.length} missing`)
        if (identical.length > 0) notes.push(`${identical.length} same as English`)

        console.log(
            `  ${code}  ${String(Math.round(coverage * 100)).padStart(3)}%  ${name}` +
                (notes.length > 0 ? ` — ${notes.join(', ')}` : ''),
        )
        if (identical.length > 0 && identical.length <= 6) {
            console.log(`           ↳ ${identical.join(', ')}`)
        }

        if (coverage < THRESHOLD) {
            failures.push(`${code} (${name}): ${Math.round(coverage * 100)}%`)
        }
    }

    if (failures.length > 0) {
        console.log(`\nBelow the ${THRESHOLD * 100}% threshold:`)
        for (const f of failures) console.log(`  · ${f}`)
        console.log('\nThese are still offered in the picker, marked with * — the assistant')
        console.log('speaks them, but some labels will appear in English.')
        process.exitCode = 1
    } else {
        console.log(`\nAll languages at or above ${THRESHOLD * 100}%.`)
    }
    console.log()
}

main()
