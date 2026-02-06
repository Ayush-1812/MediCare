'use client'

import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { savePrescription } from '@/app/actions/prescriptionActions'
import { useRouter } from 'next/navigation'

interface PrescriptionReviewProps {
    imageUrl: string
    initialMedicines: any[]
    onCancel: () => void
}

const PrescriptionReview: React.FC<PrescriptionReviewProps> = ({ imageUrl, initialMedicines, onCancel }) => {
    const router = useRouter()
    const [medicines, setMedicines] = useState(initialMedicines)
    const [saving, setSaving] = useState(false)

    const handleChange = (index: number, field: string, value: string) => {
        const updated = [...medicines]
        updated[index] = { ...updated[index], [field]: value }
        setMedicines(updated)
    }

    const handleDelete = (index: number) => {
        const updated = medicines.filter((_, i) => i !== index)
        setMedicines(updated)
    }

    const handleAdd = () => {
        setMedicines([...medicines, { original: '', normalized: '', dosage: '', frequency: '' }])
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await savePrescription({
                imageUrl,
                medicines
            })

            if (res.success) {
                toast.success('Prescription saved successfully!')
                router.push('/my-profile/prescriptions')
            } else {
                toast.error(res.message)
            }
        } catch (error) {
            toast.error('Failed to save prescription')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="bg-white rounded-xl shadow-lg border p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Review & Confirm</h2>

            <div className="mb-6 p-4 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-200 flex gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <p>AI-scanned data may contain errors. Please verify the medicine names and dosages against the original handwritten prescription.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                <div className="w-full lg:w-1/3">
                    <p className="font-medium text-gray-700 mb-2">Original Image</p>
                    <img src={imageUrl} alt="Prescription" className="w-full rounded-lg border shadow-sm" />
                </div>

                <div className="w-full lg:w-2/3 space-y-4">
                    {medicines.map((med, index) => (
                        <div key={index} className="flex gap-4 items-start bg-gray-50 p-4 rounded-lg border">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Medicine Name</label>
                                    <input
                                        type="text"
                                        className="w-full border-b bg-transparent py-1 focus:outline-none focus:border-primary font-medium text-gray-800"
                                        value={med.normalized || med.original}
                                        onChange={(e) => handleChange(index, 'normalized', e.target.value)}
                                        placeholder="e.g. Paracetamol"
                                    />
                                    {med.confidence && med.confidence < 0.6 && (
                                        <p className="text-xs text-orange-500 mt-1">Low confidence match</p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase">Dosage</label>
                                        <input
                                            type="text"
                                            className="w-full border-b bg-transparent py-1 focus:outline-none focus:border-primary text-gray-800"
                                            value={med.dosage || ''}
                                            onChange={(e) => handleChange(index, 'dosage', e.target.value)}
                                            placeholder="500mg"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase">Frequency</label>
                                        <input
                                            type="text"
                                            className="w-full border-b bg-transparent py-1 focus:outline-none focus:border-primary text-gray-800"
                                            value={med.frequency || ''}
                                            onChange={(e) => handleChange(index, 'frequency', e.target.value)}
                                            placeholder="BD"
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(index)}
                                className="text-gray-400 hover:text-red-500 p-1"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={handleAdd}
                        className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                    >
                        + Add Medicine
                    </button>
                </div>
            </div>

            <div className="flex justify-end gap-4 mt-8 pt-6 border-t">
                <button
                    onClick={onCancel}
                    className="px-6 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    disabled={saving}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200"
                >
                    {saving ? 'Saving...' : 'Confirm & Save'}
                </button>
            </div>
        </div>
    )
}

export default PrescriptionReview
