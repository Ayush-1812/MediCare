import { Type, type Schema } from '@google/genai'
import { GeminiService } from './services/geminiService'
import { medicineDatabase } from '@/lib/medicine-db'
import type { ParsedMedicine, ParsedPrescription } from '@/lib/prescriptionParser'

/**
 * Step 2 of the scan pipeline: repair garbled OCR text using clinical context.
 *
 * Tesseract reliably mangles the one token that matters most — the drug name
 * ("Pantoprazole" -> "Pantopragole", "Paracetamol" -> "Paracetsmol"). A deterministic
 * fuzzy match against `medicineDatabase` fixes the cases it knows; this pass handles the
 * rest, where the correct reading depends on dose, form and the surrounding line.
 *
 * Safety: the model is only ever allowed to CORRECT what the OCR already read. It must
 * not add a medicine that is not in the text, and every result still goes to the patient
 * for review before it is written to their record.
 */

/** Cap the prompt so a pathological scan cannot run up a large bill. */
const MAX_INPUT_CHARS = 6000

export type CorrectedMedicine = ParsedMedicine & {
    /** True when this pass changed the name that OCR produced. */
    aiCorrected?: boolean
    /** What the OCR actually read, kept so the patient can see the change. */
    ocrRead?: string
}

export type CorrectionResult = {
    medicines: CorrectedMedicine[]
    notes: string
    /** The model's cleaned-up rendering of the whole prescription. */
    correctedText: string
    /** How sure the model is that it read the prescription correctly, 0-1. */
    confidence: number
    /** Anything the model could not resolve and wants a human to check. */
    warnings: string[]
}

const SYSTEM_INSTRUCTION = `You correct OCR errors in scanned medical prescriptions.

The input is raw text produced by Tesseract from a photo of a prescription, usually
handwritten. It contains character-level errors, especially in drug names.

YOUR JOB
- Fix obvious OCR misreadings using clinical context: the dose, the dose form
  (Tab/Cap/Syp/Inj), the frequency, and what medicine plausibly pairs with them.
- Separate the prescribed medicines from the doctor's free-text notes (advice,
  follow-up, diet, instructions).

HARD RULES — these exist because the output becomes a patient's medical record:
1. NEVER invent a medicine. Every medicine you return must correspond to something
   actually present in the input text. If the input has three drug lines, return three.
2. NEVER change a dose, frequency or duration to a value that is not in the text. Copy
   them as written. Only fix character-level OCR damage (e.g. "5OOmg" -> "500mg").
3. If you cannot confidently identify a drug name, KEEP the OCR spelling as-is and add a
   warning. A wrong-but-confident drug name is far more dangerous than an unresolved one.
4. Do not add advice, diagnoses, or recommendations of your own. Notes must be the
   doctor's words, only de-garbled.
5. If the text is not a prescription at all, return an empty medicines array and say so
   in warnings.

Set "confidence" to your honest overall confidence that you read the prescription
correctly: below 0.5 if the input is largely unreadable.`

const RESPONSE_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
        medicines: {
            type: Type.ARRAY,
            description: 'One entry per medicine actually present in the OCR text.',
            items: {
                type: Type.OBJECT,
                properties: {
                    name: {
                        type: Type.STRING,
                        description: 'Corrected medicine name, e.g. "Pantoprazole".',
                    },
                    ocrRead: {
                        type: Type.STRING,
                        description: 'The garbled name exactly as it appeared in the input.',
                    },
                    dosage: { type: Type.STRING, description: 'e.g. "500mg". Empty if absent.' },
                    frequency: { type: Type.STRING, description: 'e.g. "BD" or "1-0-1". Empty if absent.' },
                    duration: { type: Type.STRING, description: 'e.g. "5 days". Empty if absent.' },
                    confidence: {
                        type: Type.NUMBER,
                        description: 'Confidence in THIS medicine name, 0-1.',
                    },
                },
                required: ['name', 'ocrRead', 'dosage', 'frequency', 'duration', 'confidence'],
            },
        },
        notes: {
            type: Type.STRING,
            description: "The doctor's advice / instructions, de-garbled. Empty string if none.",
        },
        correctedText: {
            type: Type.STRING,
            description: 'The whole prescription re-rendered with OCR errors fixed.',
        },
        confidence: { type: Type.NUMBER, description: 'Overall confidence, 0-1.' },
        warnings: {
            type: Type.ARRAY,
            description: 'Anything a human should double-check. Empty array if none.',
            items: { type: Type.STRING },
        },
    },
    required: ['medicines', 'notes', 'correctedText', 'confidence', 'warnings'],
}

type RawModelResponse = {
    medicines: {
        name: string
        ocrRead: string
        dosage: string
        frequency: string
        duration: string
        confidence: number
    }[]
    notes: string
    correctedText: string
    confidence: number
    warnings: string[]
}

function clamp01(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n)) return 0
    return Math.min(1, Math.max(0, n))
}

function blankToUndefined(value: unknown): string | undefined {
    const s = typeof value === 'string' ? value.trim() : ''
    return s.length > 0 ? s : undefined
}

/**
 * Runs the correction pass. Throws if the provider is unavailable — callers fall back to
 * the deterministic parser rather than failing the whole scan.
 */
export async function correctPrescriptionText(
    rawText: string,
    hint?: ParsedPrescription,
): Promise<CorrectionResult> {
    const input = (rawText ?? '').trim().slice(0, MAX_INPUT_CHARS)
    if (input.length === 0) throw new Error('No OCR text to correct')

    // Giving the model the deterministic parser's reading as a starting point measurably
    // steadies it, and the known-medicine list anchors spellings to real drugs.
    const parserHint =
        hint && hint.medicines.length > 0
            ? `\n\nA rule-based parser read these medicines from the same text. Treat it as a hint, not as truth:\n${hint.medicines
                  .map((m) => `- ${m.normalized}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`)
                  .join('\n')}`
            : ''

    const prompt =
        `Correct this OCR output from a prescription photo.\n\n` +
        `### RAW OCR TEXT\n${input}\n` +
        parserHint +
        `\n\n### COMMONLY PRESCRIBED MEDICINES (for spelling reference only — do not pick from this list unless the text supports it)\n` +
        medicineDatabase.join(', ')

    const service = GeminiService.getInstance()
    const response = await service.generateStructured<RawModelResponse>({
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt,
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
        label: 'prescriptionCorrector',
    })

    const medicines: CorrectedMedicine[] = (response.medicines ?? [])
        .map((m) => {
            const name = (m.name ?? '').trim()
            const ocrRead = (m.ocrRead ?? '').trim()
            return {
                original: ocrRead || name,
                normalized: name || ocrRead,
                confidence: clamp01(m.confidence),
                dosage: blankToUndefined(m.dosage),
                frequency: blankToUndefined(m.frequency),
                duration: blankToUndefined(m.duration),
                ocrRead: ocrRead || undefined,
                aiCorrected: Boolean(name && ocrRead && name.toLowerCase() !== ocrRead.toLowerCase()),
            }
        })
        .filter((m) => m.normalized.length > 0)

    return {
        medicines,
        notes: (response.notes ?? '').trim(),
        correctedText: (response.correctedText ?? '').trim(),
        confidence: clamp01(response.confidence),
        warnings: Array.isArray(response.warnings) ? response.warnings.filter(Boolean) : [],
    }
}
