/**
 * Interface localization for the voice receptionist.
 *
 * English is the source catalog (`messages.ts`); other languages come from the committed
 * `i18n.generated.ts`. Lookup falls back **per key**, not per language, so a catalog that
 * is missing one string shows English for that string and its own language everywhere
 * else — rather than the whole panel reverting to English.
 *
 * The fallback is also the honesty mechanism. If a language's catalog were absent
 * entirely the picker would still offer it and the panel would read English, which is the
 * "we support your language" lie Phase 3 forbids. `localizationCoverage` below reports
 * exactly how complete each language is, and the picker uses it to label anything
 * incomplete instead of presenting it as finished.
 */

import { MESSAGES, MESSAGE_KEYS, type MessageCatalog, type MessageKey } from './messages'
import { GENERATED_CATALOGS } from './i18n.generated'
import { DEFAULT_LANGUAGE, type LanguageCode } from './config'

const ENGLISH: MessageCatalog = MESSAGES as unknown as MessageCatalog

/** Both English variants use the source catalog directly. */
function rawCatalog(language: string): Partial<MessageCatalog> | undefined {
    if (language === 'en-IN' || language === 'en-US') return ENGLISH
    return GENERATED_CATALOGS[language]
}

/** Resolved catalogs are memoized: merging 50 keys on every render is pure waste. */
const merged = new Map<string, MessageCatalog>()

export function catalogFor(language: string): MessageCatalog {
    const cached = merged.get(language)
    if (cached) return cached

    const source = rawCatalog(language)
    const result = { ...ENGLISH }
    if (source) {
        for (const key of MESSAGE_KEYS) {
            const value = source[key]
            if (typeof value === 'string' && value.trim() !== '') result[key] = value
        }
    }

    merged.set(language, result)
    return result
}

export type Translator = (key: MessageKey, vars?: Record<string, string>) => string

export function createTranslator(language: string): Translator {
    const catalog = catalogFor(language)
    return (key, vars) => {
        let text = catalog[key] ?? ENGLISH[key] ?? key
        if (vars) {
            for (const [name, value] of Object.entries(vars)) {
                text = text.split(`{${name}}`).join(value)
            }
        }
        return text
    }
}

/**
 * Fraction of the catalog genuinely translated for a language, 0..1.
 *
 * Counts a key as translated only when it differs from the English string: a generator
 * that echoed the source back has not translated anything, and reporting that as covered
 * would defeat the point of measuring.
 */
export function localizationCoverage(language: string): number {
    if (language === 'en-IN' || language === 'en-US') return 1
    const source = rawCatalog(language)
    if (!source) return 0

    let translated = 0
    for (const key of MESSAGE_KEYS) {
        const value = source[key]
        if (typeof value !== 'string' || value.trim() === '') continue
        // `title` is the product name "Aether" and is identical by instruction, so it is
        // excluded rather than counted as an untranslated string.
        if (key === 'title') {
            translated += 1
            continue
        }
        if (value !== ENGLISH[key]) translated += 1
    }
    return translated / MESSAGE_KEYS.length
}

/** Tool name → localized activity label, with a sensible generic fallback. */
export function toolLabel(t: Translator, toolName: string): string {
    const key = `tool_${toolName}` as MessageKey
    if (MESSAGE_KEYS.includes(key)) return t(key)
    return t('tool_fallback')
}

/** Error code → localized message, falling back to the generic failure. */
export function errorMessage(t: Translator, code: string): string {
    const key = `err_${code}` as MessageKey
    if (MESSAGE_KEYS.includes(key)) return t(key)
    return t('err_internal')
}

export function isEnglish(language: string): boolean {
    return language.startsWith('en')
}

export { DEFAULT_LANGUAGE, type LanguageCode }
