'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import { FileText, Plus, StickyNote, Trash2 } from 'lucide-react'
import { deletePrescription, getPrescriptions } from '@/app/actions/prescriptionActions'
import type { ParsedMedicine } from '@/lib/prescriptionParser'

type Prescription = {
    id: string
    imageUrl: string
    medicines: ParsedMedicine[]
    notes: string | null
    createdAt: string | Date
}

const PrescriptionList = () => {
    const router = useRouter()
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
    const [loading, setLoading] = useState(true)

    const load = async () => {
        const res = await getPrescriptions()
        if (res.success) {
            setPrescriptions(res.prescriptions as unknown as Prescription[])
        } else {
            toast.error(res.message)
        }
        setLoading(false)
    }

    useEffect(() => {
        load()
    }, [])

    const handleDelete = async (id: string) => {
        const res = await deletePrescription(id)
        if (res.success) {
            toast.success(res.message)
            await load()
        } else {
            toast.error(res.message)
        }
    }

    return (
        <div className='max-w-4xl mx-auto my-10 px-4'>
            <div className='flex justify-between items-center mb-8 gap-4'>
                <div>
                    <h1 className='text-2xl font-bold text-gray-800'>My Prescriptions</h1>
                    <p className='text-gray-500 text-sm'>Digitize and store your medical records safely.</p>
                </div>
                <button
                    onClick={() => router.push('/my-profile/prescriptions/new')}
                    className='bg-primary text-white px-6 py-2 rounded-full font-medium hover:bg-blue-600 transition-colors flex items-center gap-2 shrink-0'
                >
                    <Plus className='w-5 h-5' /> Scan new
                </button>
            </div>

            {loading ? (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {[1, 2].map((i) => (
                        <div key={i} className='h-64 bg-gray-100 animate-pulse rounded-xl' />
                    ))}
                </div>
            ) : prescriptions.length === 0 ? (
                <div className='text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200'>
                    <div className='mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400'>
                        <FileText className='w-8 h-8' />
                    </div>
                    <p className='text-lg font-medium text-gray-900'>No prescriptions yet</p>
                    <p className='text-gray-500 mb-6'>Scan your first prescription to get started.</p>
                    <button
                        onClick={() => router.push('/my-profile/prescriptions/new')}
                        className='text-primary font-medium hover:underline'
                    >
                        Scan now
                    </button>
                </div>
            ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    {prescriptions.map((script) => {
                        const medicines = Array.isArray(script.medicines) ? script.medicines : []
                        return (
                            <div key={script.id} className='bg-white border rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col'>
                                <div className='h-40 bg-gray-100 overflow-hidden relative group shrink-0'>
                                    <img src={script.imageUrl} alt='Prescription' className='w-full h-full object-cover' />
                                    <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
                                        <a
                                            href={script.imageUrl}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='text-white bg-white/20 backdrop-blur px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/30'
                                        >
                                            View original
                                        </a>
                                    </div>
                                </div>

                                <div className='p-5 flex-1 flex flex-col'>
                                    <div className='flex justify-between items-start mb-3'>
                                        <p className='text-sm text-gray-500'>
                                            {new Date(script.createdAt).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </p>
                                        <button
                                            onClick={() => handleDelete(script.id)}
                                            className='text-gray-300 hover:text-red-500 transition-colors'
                                            aria-label='Delete prescription'
                                        >
                                            <Trash2 className='w-4 h-4' />
                                        </button>
                                    </div>

                                    {medicines.length > 0 ? (
                                        <div className='space-y-1.5'>
                                            {medicines.slice(0, 4).map((med, idx) => (
                                                <div key={idx} className='flex justify-between gap-3 text-sm'>
                                                    <span className='font-medium text-gray-800 truncate'>
                                                        {med.normalized || med.original}
                                                    </span>
                                                    <span className='text-gray-500 shrink-0'>
                                                        {[med.dosage, med.frequency].filter(Boolean).join(' · ')}
                                                    </span>
                                                </div>
                                            ))}
                                            {medicines.length > 4 && (
                                                <p className='text-xs text-gray-400 pt-1'>
                                                    + {medicines.length - 4} more
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className='text-sm text-gray-400'>No medicines recorded</p>
                                    )}

                                    {/* The handwritten notes, stored as text with the image */}
                                    {script.notes && (
                                        <div className='mt-4 pt-3 border-t border-gray-100'>
                                            <p className='text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5'>
                                                <StickyNote className='w-3.5 h-3.5' /> Notes
                                            </p>
                                            <p className='text-sm text-gray-600 whitespace-pre-line line-clamp-4'>
                                                {script.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default PrescriptionList
