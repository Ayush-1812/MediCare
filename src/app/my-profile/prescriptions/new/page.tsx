'use client'

import React, { useState } from 'react'
import PrescriptionUpload from '@/components/PrescriptionUpload'
import PrescriptionReview from '@/components/PrescriptionReview'
import { useRouter } from 'next/navigation'

const NewPrescription = () => {
    const router = useRouter()
    const [step, setStep] = useState<'upload' | 'review'>('upload')
    const [scanData, setScanData] = useState<{ imageUrl: string, medicines: any[] } | null>(null)

    const handleScanComplete = (imageUrl: string, medicines: any[]) => {
        setScanData({ imageUrl, medicines })
        setStep('review')
    }

    return (
        <div className="max-w-3xl mx-auto my-10 px-4">
            <button
                onClick={() => router.back()}
                className="mb-6 text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                Back to Prescriptions
            </button>

            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">
                    {step === 'upload' ? 'Scan & Digitize' : 'Verify Details'}
                </h1>
                <p className="text-gray-500">
                    {step === 'upload'
                        ? 'Upload a photo of your prescription to extract medicine details.'
                        : 'Please review the extracted information for accuracy.'
                    }
                </p>
            </div>

            {step === 'upload' ? (
                <PrescriptionUpload onScanComplete={handleScanComplete} />
            ) : (
                scanData && (
                    <PrescriptionReview
                        imageUrl={scanData.imageUrl}
                        initialMedicines={scanData.medicines}
                        onCancel={() => setStep('upload')}
                    />
                )
            )}
        </div>
    )
}

export default NewPrescription
