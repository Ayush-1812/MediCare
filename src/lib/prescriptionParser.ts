import stringSimilarity from 'string-similarity'
import { medicineDatabase } from './medicine-db'

/**
 * Turns raw OCR text from a prescription photo into structured medicines plus the
 * free-text notes the doctor wrote (advice, follow-up, instructions).
 *
 * The previous parser only ever looked at the first two whitespace tokens of a line and
 * fuzzy-matched those against the medicine list. On a normal numbered prescription line
 * — `1. Tab. Paracetamol 500mg 1-0-1 x 5 days` — those tokens are `"1."` and `"Tab."`,
 * so the drug name was never examined and every line was discarded.
 */

export type ParsedMedicine = {
    /** The name exactly as it came off the image. */
    original: string
    /** Best match from the known-medicine list, or `original` when nothing matched. */
    normalized: string
    /** Fuzzy-match confidence, 0-1. Low values need a human to check the spelling. */
    confidence: number
    dosage?: string
    frequency?: string
    duration?: string
}

export type ParsedPrescription = {
    medicines: ParsedMedicine[]
    /** Advice / instructions / follow-up lines, kept verbatim, one per line. */
    notes: string
    /** The unmodified OCR output, so nothing the scan read is ever thrown away. */
    rawText: string
}

// ─── Patterns ────────────────────────────────────────────────────────────────

/** `1.` `2)` `-` `*` `•` at the start of a line. */
const ITEM_MARKER = /^\s*(?:\d{1,2}\s*[.)\]]|[-*•·])\s*/

/** Dose forms doctors prefix the drug with. */
const FORM_PREFIX =
    /^(?:tabs?|tablets?|caps?|capsules?|syp|syrup|inj|injection|susp|suspension|oint|ointment|drops?|cream|gel|lotion|powder|sachets?|neb|nebuliser|puff|inhaler)\b\.?\s*/i

/** `500mg`, `40 mg`, `5ml`, `1000 IU`, `0.5%`. */
const DOSAGE = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|l|iu|units?|%)\b/i

/** Counted doses: `2 drops`, `1 puff`, `2 tsp`, `1 sachet`. */
const DOSE_COUNT = /\b\d+(?:\.\d+)?\s*(?:drops?|puffs?|tsp|tbsp|spoons?|sachets?|units?|tabs?|caps?)\b/i

/** Latin abbreviations plus the Indian `1-0-1` morning-noon-night notation. */
const FREQUENCY_WORD = /\b(?:OD|BD|BID|TDS|TID|QID|QDS|HS|SOS|PRN|STAT|OM|ON|QAM|QPM)\b/i
const FREQUENCY_PATTERN = /\b[01½]\s*-\s*[01½]\s*-\s*[01½](?:\s*-\s*[01½])?\b/

/** `x 5 days`, `x5 days`, `for 2 weeks`, `× 1 month`. */
const DURATION = /\b(?:x|×|for)?\s*(\d{1,3})\s*(day|days|week|weeks|month|months|wk|wks|mo)\b/i

/** Lines that are clearly the doctor's advice rather than a drug. */
const NOTE_MARKER =
    /^\s*(?:advice|advise|advices|note|notes|instruction|instructions|remarks?|caution|warning|follow[\s-]?up|f\/u|review|revisit|diet|rest|investigation|invest|test|tests|lab)\b\s*[:\-–]?\s*/i

/** Boilerplate that carries no clinical meaning. */
const NOISE = /^(?:r[xk]|℞|prescription|signature|sign)\s*[:\-–]?\s*$/i

/** Letterhead fields — `Patient: Ramesh`, `Date: 12/08/2026`, `Dr. Sharma`. */
const LETTERHEAD =
    /^(?:(?:patient|name|age|sex|gender|date|dob|address|reg\.? ?no|regn|ph|phone|mob(?:ile)?|email|opd|uhid|id)\s*(?:no\.?)?\s*[:\-–]|dr\.?\s+[a-z]|(?:[a-z .&'-]+\s(?:clinic|hospital|nursing home|medical cent(?:er|re)|polyclinic))\s*$)/i

/** A name is worth trusting as a known medicine at or above this similarity. */
const MATCH_THRESHOLD = 0.55

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bestMedicineMatch(candidate: string): { target: string; rating: number } {
    const cleaned = candidate.trim()
    // `findBestMatch` throws on an empty string or empty target list.
    if (cleaned.length < 3 || medicineDatabase.length === 0) {
        return { target: cleaned, rating: 0 }
    }
    const { bestMatch } = stringSimilarity.findBestMatch(cleaned.toLowerCase(), medicineDatabase.map((m) => m.toLowerCase()))
    const index = medicineDatabase.findIndex((m) => m.toLowerCase() === bestMatch.target)
    return { target: index >= 0 ? medicineDatabase[index] : cleaned, rating: bestMatch.rating }
}

/** Strips the numbering and dose form, then cuts the name off at the first dose/frequency. */
function extractName(line: string): string {
    let text = line.replace(ITEM_MARKER, '').replace(FORM_PREFIX, '')

    const cutPoints = [DOSAGE, DOSE_COUNT, FREQUENCY_WORD, FREQUENCY_PATTERN, DURATION]
        .map((re) => text.search(re))
        .filter((index) => index > 0)

    if (cutPoints.length > 0) {
        text = text.slice(0, Math.min(...cutPoints))
    }

    // Drop trailing separators and any leftover form abbreviation.
    return text
        .replace(/[.,;:\-–_/\\]+\s*$/, '')
        .replace(FORM_PREFIX, '')
        .trim()
}

function firstMatch(line: string, re: RegExp): string | undefined {
    const match = line.match(re)
    return match ? match[0].replace(/\s+/g, ' ').trim() : undefined
}

function looksLikeMedicine(line: string): boolean {
    if (FORM_PREFIX.test(line.replace(ITEM_MARKER, ''))) return true
    if (DOSAGE.test(line) || DOSE_COUNT.test(line)) return true
    if (FREQUENCY_WORD.test(line) || FREQUENCY_PATTERN.test(line)) return true

    // No structural hint — fall back to asking whether the text itself reads like a
    // known drug, which catches bare lines such as "Azithromycin".
    const name = extractName(line)
    return name.length >= 4 && bestMedicineMatch(name).rating >= MATCH_THRESHOLD
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function parsePrescription(rawText: string): ParsedPrescription {
    const medicines: ParsedMedicine[] = []
    const notes: string[] = []

    const lines = (rawText ?? '')
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter((line) => line.length > 0)

    for (const line of lines) {
        if (NOISE.test(line) || LETTERHEAD.test(line)) continue

        const isNote = NOTE_MARKER.test(line)

        // An advice line can still name a drug ("Review after 1 week"), so the note
        // marker wins: it tells us the doctor was writing prose, not prescribing.
        if (isNote) {
            notes.push(line)
            continue
        }

        if (!looksLikeMedicine(line)) {
            // Anything left that has real words is instruction text worth keeping —
            // discarding it is how the handwritten notes got lost before.
            if (/[a-z]{3,}/i.test(line)) notes.push(line)
            continue
        }

        const name = extractName(line)
        if (!name) continue

        const { target, rating } = bestMedicineMatch(name)
        const matched = rating >= MATCH_THRESHOLD

        medicines.push({
            original: name,
            // A confident match repairs OCR slips in the one token that matters most —
            // "Pantopragole" becomes "Pantoprazole" — while a weak match is left alone
            // rather than silently renaming a drug to something the doctor never wrote.
            normalized: matched ? target : name,
            confidence: Number(rating.toFixed(2)),
            dosage: firstMatch(line, DOSAGE) ?? firstMatch(line, DOSE_COUNT),
            frequency: firstMatch(line, FREQUENCY_WORD) ?? firstMatch(line, FREQUENCY_PATTERN),
            duration: firstMatch(line, DURATION),
        })
    }

    return {
        medicines,
        notes: notes.join('\n'),
        rawText: (rawText ?? '').trim(),
    }
}

/** Backwards-compatible helper for callers that only want the medicine list. */
export function normalizeMedicineData(rawText: string): ParsedMedicine[] {
    return parsePrescription(rawText).medicines
}
