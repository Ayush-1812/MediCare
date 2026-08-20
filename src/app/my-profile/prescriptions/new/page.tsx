'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import PrescriptionUpload, { type ScanResult } from '@/components/PrescriptionUpload'
import PrescriptionReview from '@/components/PrescriptionReview'

const NewPrescription = () => {
    const router = useRouter()
    const [scan, setScan] = useState<ScanResult | null>(null)

    return (
        <div className='max-w-4xl mx-auto my-10 px-4'>
            <button
                onClick={() => router.push('/my-profile/prescriptions')}
                className='mb-6 text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm'
            >
                <ChevronLeft className='w-4 h-4' />
                Back to prescriptions
            </button>

            <div className='mb-8'>
                <h1 className='text-2xl font-bold text-gray-900'>
                    {scan ? 'Verify details' : 'Scan & digitize'}
                </h1>
                <p className='text-gray-500'>
                    {scan
                        ? 'Check the extracted medicines and notes against the image before saving.'
                        : 'Upload a photo of your prescription to extract the medicines and notes.'}
                </p>
            </div>

            {scan ? (
                <PrescriptionReview scan={scan} onCancel={() => setScan(null)} />
            ) : (
                <PrescriptionUpload onScanComplete={setScan} />
            )}
        </div>
    )
}

export default NewPrescription
