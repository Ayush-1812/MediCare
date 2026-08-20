'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { v2 as cloudinary } from 'cloudinary'
import { getSessionId } from '@/lib/auth'
import { parsePrescription, type ParsedMedicine } from '@/lib/prescriptionParser'
import { correctPrescriptionText, type CorrectedMedicine } from '@/lib/ai/prescriptionCorrector'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
)

/** Cap on an inline data-URL image, used only when Cloudinary is not configured. */
const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_RAW_TEXT_CHARS = 20_000

/** The AI correction pass is skipped entirely when no key is configured. */
const aiCorrectionEnabled = Boolean(process.env.GEMINI_API_KEY)
const MAX_NOTES_CHARS = 5_000

function fail(message: string) {
    return { success: false as const, message }
}

function unexpected(scope: string, error: unknown) {
    console.error(`[${scope}]`, error)
    return fail('Something went wrong. Please try again.')
}

/**
 * Stores the scanned image and returns a URL for it.
 *
 * Prefers Cloudinary. Without those credentials the image is kept as the original data
 * URL — the previous behaviour — but only up to a size cap, because a multi-megabyte
 * base64 string in a Postgres column is a real cost and was previously unbounded.
 */
async function storeImage(imageDataUrl: string): Promise<string> {
    if (!cloudinaryConfigured) {
        // Base64 inflates the payload by ~4/3.
        const approxBytes = Math.ceil((imageDataUrl.length * 3) / 4)
        if (approxBytes > MAX_INLINE_IMAGE_BYTES) {
            throw new Error(
                'That image is too large to store. Please upload a smaller photo, or configure Cloudinary.',
            )
        }
        console.warn(
            '[prescriptions] Cloudinary is not configured — storing the image inline as a data URL. ' +
                'Set CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET to store images properly.',
        )
        return imageDataUrl
    }

    const uploaded = await cloudinary.uploader.upload(imageDataUrl, {
        resource_type: 'image',
        folder: 'medicare/prescriptions',
    })
    return uploaded.secure_url
}

// ─── Scan ────────────────────────────────────────────────────────────────────

/**
 * Turns the OCR text from the patient's photo into medicines plus the handwritten notes.
 *
 * Two stages:
 *   1. A deterministic parser splits lines into medicines and notes and fuzzy-repairs
 *      names it recognises. Free, instant, and never wrong in surprising ways.
 *   2. An LLM pass re-reads the garbled text with clinical context, catching the drug
 *      names Tesseract mangles that the fuzzy match cannot rescue.
 *
 * Stage 2 is strictly an enhancement: if the provider is unavailable, slow, or returns
 * nothing usable, the parser's result is returned instead and the scan still works.
 * Either way the patient reviews everything before it is saved.
 */
export async function processPrescriptionText(rawText: string) {
    try {
        // Previously this only checked that a cookie existed, without verifying it.
        const userId = await getSessionId('user')
        if (!userId) return fail('Your session has expired. Please sign in again.')

        if (typeof rawText !== 'string' || rawText.trim().length === 0) {
            return fail('No text could be read from that image.')
        }

        const parsed = parsePrescription(rawText.slice(0, MAX_RAW_TEXT_CHARS))

        if (!aiCorrectionEnabled) {
            return { success: true as const, ...parsed, source: 'parser' as const, warnings: [] as string[] }
        }

        try {
            const corrected = await correctPrescriptionText(parsed.rawText, parsed)

            // Guard against the model returning nothing useful: if it found no medicines
            // but the parser did, the parser's reading is the safer answer.
            if (corrected.medicines.length === 0 && parsed.medicines.length > 0) {
                console.warn('[processPrescriptionText] AI returned no medicines; keeping parser output')
                return {
                    success: true as const,
                    ...parsed,
                    source: 'parser' as const,
                    warnings: ['The AI pass could not read this scan, so the basic reading is shown.'],
                }
            }

            return {
                success: true as const,
                medicines: corrected.medicines as CorrectedMedicine[],
                // Prefer the model's notes, but never lose the parser's if it found some
                // and the model returned none.
                notes: corrected.notes || parsed.notes,
                rawText: parsed.rawText,
                correctedText: corrected.correctedText,
                aiConfidence: corrected.confidence,
                source: 'ai' as const,
                warnings: corrected.warnings,
            }
        } catch (error) {
            // Provider down, quota exhausted, timeout — degrade, never block the scan.
            console.error('[processPrescriptionText] AI correction failed, falling back to parser:', error)
            return {
                success: true as const,
                ...parsed,
                source: 'parser' as const,
                warnings: ['AI correction was unavailable, so the basic reading is shown.'],
            }
        }
    } catch (error) {
        return unexpected('processPrescriptionText', error)
    }
}

// ─── Save ────────────────────────────────────────────────────────────────────

export async function savePrescription(data: {
    imageUrl: string
    medicines: ParsedMedicine[]
    notes?: string
    rawText?: string
    ocrConfidence?: number
    ocrEngine?: string
}) {
    try {
        const userId = await getSessionId('user')
        if (!userId) return fail('Your session has expired. Please sign in again.')

        if (!data.imageUrl) return fail('The prescription image is missing.')

        const medicines = Array.isArray(data.medicines) ? data.medicines : []
        const notes = (data.notes ?? '').trim().slice(0, MAX_NOTES_CHARS)
        const rawText = (data.rawText ?? '').trim().slice(0, MAX_RAW_TEXT_CHARS)

        // A scan with no medicines *and* no notes carries nothing beyond the photo, which
        // is exactly the case the patient is trying to avoid.
        if (medicines.length === 0 && notes.length === 0) {
            return fail('Add at least one medicine or a note before saving.')
        }

        let imageUrl: string
        try {
            imageUrl = await storeImage(data.imageUrl)
        } catch (error) {
            console.error('[savePrescription] image storage failed', error)
            return fail(error instanceof Error ? error.message : 'Could not store the prescription image.')
        }

        await prisma.prescription.create({
            data: {
                userId,
                imageUrl,
                medicines,
                notes: notes || null,
                rawText: rawText || null,
                ocrEngine: data.ocrEngine ?? null,
                ocrConfidence: Number.isFinite(data.ocrConfidence) ? data.ocrConfidence : null,
                // The patient reviewed and corrected this screen before saving.
                isVerified: true,
            },
        })

        revalidatePath('/my-profile/prescriptions')
        return { success: true as const, message: 'Prescription saved successfully' }
    } catch (error) {
        return unexpected('savePrescription', error)
    }
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getPrescriptions() {
    try {
        const userId = await getSessionId('user')
        if (!userId) return fail('Your session has expired. Please sign in again.')

        const prescriptions = await prisma.prescription.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                imageUrl: true,
                medicines: true,
                notes: true,
                rawText: true,
                ocrEngine: true,
                ocrConfidence: true,
                isVerified: true,
                createdAt: true,
            },
        })

        return { success: true as const, prescriptions }
    } catch (error) {
        return unexpected('getPrescriptions', error)
    }
}

export async function deletePrescription(prescriptionId: string) {
    try {
        const userId = await getSessionId('user')
        if (!userId) return fail('Your session has expired. Please sign in again.')

        // Scoped to the owner so an id alone cannot delete someone else's record.
        const result = await prisma.prescription.deleteMany({
            where: { id: prescriptionId, userId },
        })
        if (result.count === 0) return fail('Prescription not found')

        revalidatePath('/my-profile/prescriptions')
        return { success: true as const, message: 'Prescription deleted' }
    } catch (error) {
        return unexpected('deletePrescription', error)
    }
}
