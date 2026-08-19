'use client'

import React, { useContext, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppContext } from '../context/AppContext'
import DoctorCard from './DoctorCard'

const RelatedDoctors = ({ speciality, docId }: { speciality: string, docId: string }) => {
    const router = useRouter()
    const { doctors } = useContext(AppContext)

    const relDoc = useMemo(
        () => (doctors as any[]).filter((doc) => doc.speciality === speciality && doc.id !== docId),
        [doctors, speciality, docId],
    )

    // Nothing useful to show when this is the only doctor in the speciality.
    if (relDoc.length === 0) return null

    return (
        <div className='flex flex-col items-center gap-4 my-16 text-gray-900 md:mx-10'>
            <h1 className='text-3xl font-medium'>Related Doctors</h1>
            <p className='sm:w-1/3 text-center text-sm'>Simply browse through our extensive list of trusted doctors.</p>
            <div className='w-full grid gap-4 pt-5 gap-y-6 px-3 sm:px-0' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {relDoc.slice(0, 5).map((item) => (
                    <DoctorCard key={item.id} doctor={item} scrollToTop />
                ))}
            </div>
            <button onClick={() => { router.push('/doctors'); window.scrollTo(0, 0) }} className='bg-blue-50 text-gray-600 px-12 py-3 rounded-full mt-10'>more</button>
        </div>
    )
}

export default RelatedDoctors
