'use client'

import React, { useContext } from 'react'
import { useRouter } from 'next/navigation'
import { AppContext } from '../context/AppContext'
import DoctorCard from './DoctorCard'

const TopDoctors = () => {
    const router = useRouter()
    const { doctors } = useContext(AppContext)

    return (
        <div className='flex flex-col items-center gap-4 my-16 text-gray-900 md:mx-10'>
            <h1 className='text-3xl font-medium'>Top Doctors to Book</h1>
            <p className='sm:w-1/3 text-center text-sm'>Simply browse through our extensive list of trusted doctors.</p>
            <div className='w-full grid gap-4 pt-5 gap-y-6 px-3 sm:px-0' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {doctors?.slice(0, 10).map((item: any) => (
                    <DoctorCard key={item.id} doctor={item} />
                ))}
            </div>
            <button onClick={() => router.push('/doctors')} className='bg-blue-50 text-gray-600 px-12 py-3 rounded-full mt-10'>more</button>
        </div>
    )
}

export default TopDoctors
