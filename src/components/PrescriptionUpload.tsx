'use client'

import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { createWorker } from 'tesseract.js'
import { processPrescriptionText } from '@/app/actions/prescriptionActions'
import type { CorrectedMedicine } from '@/lib/ai/prescriptionCorrector'

export type ScanResult = {
    imageDataUrl: string
    medicines: CorrectedMedicine[]
    notes: string
    rawText: string
    ocrConfidence: number
    /** Whether the AI correction pass ran, or the rule-based parser was used. */
    source: 'ai' | 'parser'
    /** The model's cleaned-up reading of the whole prescription, when available. */
    correctedText?: string
    aiConfidence?: number
    warnings: string[]
}

interface PrescriptionUploadProps {
    onScanComplete: (result: ScanResult) => void
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Could not read that file'))
        reader.readAsDataURL(file)
    })

const PrescriptionUpload: React.FC<PrescriptionUploadProps> = ({ onScanComplete }) => {
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        // Reset so re-picking the same file still fires onChange.
        e.target.value = ''
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file')
            return
        }
        if (file.size > MAX_IMAGE_BYTES) {
            toast.error('That image is larger than 8MB. Please upload a smaller photo.')
            return
        }

        setUploading(true)
        setProgress(0)
        const toastId = toast.loading('Reading the prescription... this can take a moment.')

        let worker: Awaited<ReturnType<typeof createWorker>> | null = null
        try {
            // The image is read first: even if OCR finds nothing, the patient can still
            // save the photo and type the details in by hand.
            const imageDataUrl = await readAsDataUrl(file)

            worker = await createWorker('eng', undefined, {
                logger: (m) => {
                    if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100))
                },
            })
            setProgress(0)
            const { data } = await worker.recognize(file)
            const rawText = data.text ?? ''
            const ocrConfidence = typeof data.confidence === 'number' ? data.confidence : 0

            if (rawText.trim().length === 0) {
                toast.update(toastId, {
                    render: 'No text could be read. You can still save the photo and type the details in.',
                    type: 'warning',
                    isLoading: false,
                    autoClose: 5000,
                })
                onScanComplete({
                    imageDataUrl,
                    medicines: [],
                    notes: '',
                    rawText: '',
                    ocrConfidence,
                    source: 'parser',
                    warnings: [],
                })
                return
            }

            const result = await processPrescriptionText(rawText)
            if (!result.success) {
                toast.update(toastId, { render: result.message, type: 'error', isLoading: false, autoClose: 4000 })
                return
            }

            const found = result.medicines.length
            toast.update(toastId, {
                render: found > 0
                    ? `Found ${found} medicine${found === 1 ? '' : 's'}. Please check them against the image.`
                    : 'Text read, but no medicines were recognised. Please add them below.',
                type: found > 0 ? 'success' : 'warning',
                isLoading: false,
                autoClose: 4000,
            })

            onScanComplete({
                imageDataUrl,
                medicines: result.medicines,
                notes: result.notes,
                rawText: result.rawText,
                ocrConfidence,
                source: result.source,
                correctedText: 'correctedText' in result ? result.correctedText : undefined,
                aiConfidence: 'aiConfidence' in result ? result.aiConfidence : undefined,
                warnings: result.warnings ?? [],
            })
        } catch (error) {
            console.error('[PrescriptionUpload]', error)
            toast.update(toastId, {
                render: 'Could not process that image. Please try another photo.',
                type: 'error',
                isLoading: false,
                autoClose: 4000,
            })
        } finally {
            // The worker holds a WASM instance and a web worker; leaking one per scan
            // would pile up across uploads.
            await worker?.terminate().catch(() => {})
            setUploading(false)
            setProgress(0)
        }
    }

    return (
        <div className='border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center bg-gray-50 text-center'>
            <div className='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-primary'>
                <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' />
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M15 13a3 3 0 11-6 0 3 3 0 016 0z' />
                </svg>
            </div>

            <h3 className='text-lg font-medium text-gray-900 mb-2'>Scan Prescription</h3>
            <p className='text-gray-500 mb-6 max-w-sm'>
                Upload a clear, well-lit photo. We extract the medicine names and the written notes —
                you get to correct everything before it is saved.
            </p>

            <input
                type='file'
                accept='image/*'
                onChange={handleFileChange}
                className='hidden'
                id='file-upload'
                disabled={uploading}
            />

            <label
                htmlFor='file-upload'
                className={`bg-primary text-white px-6 py-3 rounded-full font-medium transition-colors ${
                    uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-600'
                }`}
            >
                {uploading ? (progress > 0 ? `Reading... ${progress}%` : 'Reading...') : 'Upload Image'}
            </label>

            {uploading && (
                <div className='w-full max-w-xs bg-gray-200 rounded-full h-1.5 mt-4 overflow-hidden'>
                    <div className='bg-primary h-1.5 rounded-full transition-all duration-300' style={{ width: `${progress}%` }} />
                </div>
            )}

            <p className='text-xs text-gray-400 mt-4'>JPG or PNG, up to 8MB</p>
        </div>
    )
}

export default PrescriptionUpload
