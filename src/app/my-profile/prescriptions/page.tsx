'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPrescriptions } from '@/app/actions/prescriptionActions'

const PrescriptionList = () => {
    const router = useRouter()
    const [prescriptions, setPrescriptions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPrescriptions = async () => {
            const res = await getPrescriptions()
            if (res.success) {
                setPrescriptions(res.prescriptions || [])
            }
            setLoading(false)
        }
        fetchPrescriptions()
    }, [])

    return (
        <div className="max-w-4xl mx-auto my-10 px-4">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">My Prescriptions</h1>
                    <p className="text-gray-500 text-sm">Digitize and store your medical records safely.</p>
                </div>
                <button
                    onClick={() => router.push('/my-profile/prescriptions/new')}
                    className="bg-primary text-white px-6 py-2 rounded-full font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    Scan New
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                        <div key={i} className="h-40 bg-gray-100 animate-pulse rounded-xl"></div>
                    ))}
                </div>
            ) : prescriptions.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </div>
                    <p className="text-lg font-medium text-gray-900">No prescriptions yet</p>
                    <p className="text-gray-500 mb-6">Scan your first handwritten prescription to get started.</p>
                    <button
                        onClick={() => router.push('/my-profile/prescriptions/new')}
                        className="text-primary font-medium hover:underline"
                    >
                        Scan Now
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {prescriptions.map((script) => (
                        <div key={script.id} className="bg-white border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                            <div className="h-48 bg-gray-100 overflow-hidden relative group">
                                <img src={script.imageUrl} alt="Prescription" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <a
                                        href={script.imageUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-white bg-white/20 backdrop-blur px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/30"
                                    >
                                        View Original
                                    </a>
                                </div>
                            </div>
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <p className="text-sm text-gray-500">{new Date(script.createdAt).toLocaleDateString()}</p>
                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Processed</span>
                                </div>

                                <div className="space-y-2">
                                    {(script.medicines as any[]).slice(0, 3).map((med, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span className="font-medium text-gray-800">{med.normalized || med.original}</span>
                                            <span className="text-gray-500">{med.dosage}</span>
                                        </div>
                                    ))}
                                    {(script.medicines as any[]).length > 3 && (
                                        <p className="text-xs text-gray-400 mt-2">+ {(script.medicines as any[]).length - 3} more medicines</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default PrescriptionList
