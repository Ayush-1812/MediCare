'use client'

import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { createWorker } from 'tesseract.js'
import { processPrescriptionText } from '@/app/actions/prescriptionActions'

interface PrescriptionUploadProps {
    onScanComplete: (imageUrl: string, results: any) => void
}

const PrescriptionUpload: React.FC<PrescriptionUploadProps> = ({ onScanComplete }) => {
    const [uploading, setUploading] = useState(false)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file')
            return
        }

        setUploading(true)
        const toastId = toast.loading("Processing image... This may take a moment.")

        try {
            // 1. Client-Side OCR
            const worker = await createWorker('eng')
            const ret = await worker.recognize(file)
            const rawText = ret.data.text
            await worker.terminate()

            if (!rawText || rawText.trim().length === 0) {
                toast.update(toastId, { render: "No text found in image", type: "error", isLoading: false, autoClose: 3000 })
                setUploading(false)
                return
            }

            // 2. Normalize on Server
            const result = await processPrescriptionText(rawText)

            // For the reviewed image preview
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = async () => {
                const base64data = reader.result as string;

                if (result.success) {
                    toast.update(toastId, { render: "Scan Complete!", type: "success", isLoading: false, autoClose: 3000 })
                    onScanComplete(base64data, result.medicines)
                } else {
                    toast.update(toastId, { render: "Scan Failed", type: "error", isLoading: false, autoClose: 3000 })
                }
            }

        } catch (error) {
            console.error(error)
            toast.update(toastId, { render: "Upload Failed", type: "error", isLoading: false, autoClose: 3000 })
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center bg-gray-50 text-center hover:bg-gray-100 transition-colors">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-primary">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-2">Scan Prescription</h3>
            <p className="text-gray-500 mb-6 max-w-sm">Upload a clear photo of your handwritten prescription. We'll extract the details for you.</p>

            <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={uploading}
            />

            <label
                htmlFor="file-upload"
                className={`bg-primary text-white px-6 py-3 rounded-full cursor-pointer font-medium hover:bg-blue-600 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {uploading ? 'Scanning...' : 'Upload Image'}
            </label>

            <p className="text-xs text-gray-400 mt-4">Supported formats: JPG, PNG</p>
        </div>
    )
}

export default PrescriptionUpload
