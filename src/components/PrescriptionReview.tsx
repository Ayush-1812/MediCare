'use client'

import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronDown, Plus, Sparkles, Trash2 } from 'lucide-react'
import { savePrescription } from '@/app/actions/prescriptionActions'
import type { ScanResult } from './PrescriptionUpload'
import type { CorrectedMedicine } from '@/lib/ai/prescriptionCorrector'

interface PrescriptionReviewProps {
    scan: ScanResult
    onCancel: () => void
}

const fieldClass =
    'w-full border-b border-gray-200 bg-transparent py-1 focus:outline-none focus:border-primary text-gray-800'
const labelClass = 'text-xs font-semibold text-gray-500 uppercase'

const emptyMedicine: CorrectedMedicine = {
    original: '',
    normalized: '',
    confidence: 1,
    dosage: '',
    frequency: '',
    duration: '',
}

const PrescriptionReview: React.FC<PrescriptionReviewProps> = ({ scan, onCancel }) => {
    const router = useRouter()
    const [medicines, setMedicines] = useState<CorrectedMedicine[]>(scan.medicines)
    const [notes, setNotes] = useState(scan.notes)
    const [showRawText, setShowRawText] = useState(false)
    const [saving, setSaving] = useState(false)

    const update = (index: number, field: keyof CorrectedMedicine, value: string) => {
        setMedicines((prev) =>
            prev.map((med, i) => (i === index ? { ...med, [field]: value } : med)),
        )
    }

    const handleSave = async () => {
        if (saving) return

        // Drop rows the patient left blank rather than storing empty medicines.
        const cleaned = medicines
            .map((med) => ({
                ...med,
                normalized: (med.normalized || med.original || '').trim(),
                original: (med.original || med.normalized || '').trim(),
            }))
            .filter((med) => med.normalized.length > 0)

        if (cleaned.length === 0 && notes.trim().length === 0) {
            toast.error('Add at least one medicine or a note before saving.')
            return
        }

        setSaving(true)
        let res
        try {
            res = await savePrescription({
                imageUrl: scan.imageDataUrl,
                medicines: cleaned,
                notes,
                rawText: scan.rawText,
                ocrConfidence: scan.ocrConfidence,
                ocrEngine: scan.source === 'ai' ? 'tesseract.js@eng + gemini' : 'tesseract.js@eng',
            })
        } finally {
            setSaving(false)
        }

        if (!res.success) {
            toast.error(res.message)
            return
        }

        toast.success(res.message)
        router.push('/my-profile/prescriptions')
    }

    return (
        <div className='bg-white rounded-xl shadow-lg border p-6'>
            <div className='flex flex-wrap items-center gap-3 mb-6'>
                <h2 className='text-2xl font-bold text-gray-800'>Review &amp; Confirm</h2>
                {scan.source === 'ai' && (
                    <span className='inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full'>
                        <Sparkles className='w-3.5 h-3.5' /> AI-corrected
                        {typeof scan.aiConfidence === 'number' &&
                            ` · ${Math.round(scan.aiConfidence * 100)}% confident`}
                    </span>
                )}
            </div>

            {scan.warnings.length > 0 && (
                <ul className='mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 space-y-1'>
                    {scan.warnings.map((w, i) => (
                        <li key={i} className='flex gap-2'>
                            <span aria-hidden>•</span>
                            <span>{w}</span>
                        </li>
                    ))}
                </ul>
            )}

            <div className='mb-6 p-4 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200 flex gap-2'>
                <AlertTriangle className='w-5 h-5 shrink-0' />
                <p>
                    Scanned text is often wrong on handwriting. Check every medicine name and dosage
                    against the image before saving — this becomes part of your health record.
                </p>
            </div>

            <div className='flex flex-col lg:flex-row gap-8'>
                {/* Image + what the scan actually read */}
                <div className='w-full lg:w-1/3'>
                    <p className='font-medium text-gray-700 mb-2'>Original image</p>
                    <img src={scan.imageDataUrl} alt='Prescription' className='w-full rounded-lg border shadow-sm' />

                    {scan.rawText && (
                        <div className='mt-4'>
                            <button
                                type='button'
                                onClick={() => setShowRawText((v) => !v)}
                                className='flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900'
                            >
                                <ChevronDown className={`w-4 h-4 transition-transform ${showRawText ? 'rotate-180' : ''}`} />
                                Text read from the image
                            </button>
                            {showRawText && (
                                <pre className='mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 whitespace-pre-wrap max-h-64 overflow-y-auto'>
                                    {scan.rawText}
                                </pre>
                            )}
                            <p className='text-xs text-gray-400 mt-2'>
                                Scan confidence {Math.round(scan.ocrConfidence)}%. Saved with the record.
                            </p>
                        </div>
                    )}
                </div>

                <div className='w-full lg:w-2/3'>
                    {/* Medicines */}
                    <p className='font-medium text-gray-700 mb-3'>Medicines</p>
                    <div className='space-y-4'>
                        {medicines.length === 0 && (
                            <p className='text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4'>
                                No medicines were recognised. Add them from the image below.
                            </p>
                        )}

                        {medicines.map((med, index) => (
                            <div key={index} className='flex gap-4 items-start bg-gray-50 p-4 rounded-lg border'>
                                <div className='flex-1 grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    <div>
                                        <label className={labelClass}>Medicine name</label>
                                        <input
                                            type='text'
                                            className={`${fieldClass} font-medium`}
                                            value={med.normalized || med.original}
                                            onChange={(e) => update(index, 'normalized', e.target.value)}
                                            placeholder='e.g. Paracetamol'
                                        />
                                        {med.confidence < 0.55 && (med.normalized || med.original) && (
                                            <p className='text-xs text-orange-600 mt-1'>
                                                Not recognised — please check the spelling
                                            </p>
                                        )}
                                        {med.confidence >= 0.55 &&
                                            med.original &&
                                            med.original !== med.normalized && (
                                                <p className='text-xs text-gray-500 mt-1'>
                                                    {med.aiCorrected ? 'AI corrected from' : 'Read as'}{' '}
                                                    &ldquo;{med.original}&rdquo;
                                                </p>
                                            )}
                                    </div>
                                    <div className='grid grid-cols-3 gap-3'>
                                        <div>
                                            <label className={labelClass}>Dosage</label>
                                            <input
                                                type='text'
                                                className={fieldClass}
                                                value={med.dosage ?? ''}
                                                onChange={(e) => update(index, 'dosage', e.target.value)}
                                                placeholder='500mg'
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Frequency</label>
                                            <input
                                                type='text'
                                                className={fieldClass}
                                                value={med.frequency ?? ''}
                                                onChange={(e) => update(index, 'frequency', e.target.value)}
                                                placeholder='BD'
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Duration</label>
                                            <input
                                                type='text'
                                                className={fieldClass}
                                                value={med.duration ?? ''}
                                                onChange={(e) => update(index, 'duration', e.target.value)}
                                                placeholder='5 days'
                                            />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setMedicines((prev) => prev.filter((_, i) => i !== index))}
                                    className='text-gray-400 hover:text-red-500 p-1'
                                    aria-label='Remove medicine'
                                >
                                    <Trash2 className='w-5 h-5' />
                                </button>
                            </div>
                        ))}

                        <button
                            onClick={() => setMedicines((prev) => [...prev, { ...emptyMedicine }])}
                            className='text-sm text-primary font-medium hover:underline flex items-center gap-1'
                        >
                            <Plus className='w-4 h-4' /> Add medicine
                        </button>
                    </div>

                    {/* Notes — the handwritten advice, stored as text with the image */}
                    <div className='mt-8'>
                        <label className='font-medium text-gray-700 mb-1 block'>Notes &amp; instructions</label>
                        <p className='text-xs text-gray-500 mb-2'>
                            Advice, follow-up and anything else written on the prescription. Edit freely — this
                            is saved as text alongside the image.
                        </p>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={5}
                            maxLength={5000}
                            placeholder='e.g. Take after food. Review after 1 week.'
                            className='w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-blue-500/20 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none transition-all'
                        />
                    </div>
                </div>
            </div>

            <div className='flex justify-end gap-4 mt-8 pt-6 border-t'>
                <button
                    onClick={onCancel}
                    className='px-6 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors'
                    disabled={saving}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className='px-6 py-2 bg-primary disabled:bg-blue-300 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors'
                >
                    {saving ? 'Saving...' : 'Confirm & Save'}
                </button>
            </div>
        </div>
    )
}

export default PrescriptionReview
