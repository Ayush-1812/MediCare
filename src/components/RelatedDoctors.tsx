'use client'

import React, { useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppContext } from '../context/AppContext'

const RelatedDoctors = ({ speciality, docId }: { speciality: string, docId: string }) => {
    const router = useRouter()
    const { doctors } = useContext(AppContext)
    const [relDoc, setRelDoc] = useState<any[]>([])

    useEffect(() => {
        if (doctors.length > 0 && speciality) {
            const doctorsData = doctors.filter((doc: any) => doc.speciality === speciality && doc.id !== docId)
            setRelDoc(doctorsData)
        }
    }, [doctors, speciality, docId])

    return (
        <div className='flex flex-col items-center gap-4 my-16 text-gray-900 md:mx-10'>
            <h1 className='text-3xl font-medium'>Related Doctors</h1>
            <p className='sm:w-1/3 text-center text-sm'>Simply browse through our extensive list of trusted doctors.</p>
            <div className='w-full grid grid-cols-auto gap-4 pt-5 gap-y-6 px-3 sm:px-0' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {relDoc.slice(0, 5).map((item, index) => (
                    <div onClick={() => { router.push(`/appointment/${item.id}`); window.scrollTo(0, 0) }} className='border border-blue-200 rounded-xl overflow-hidden cursor-pointer hover:translate-y-[-10px] transition-all duration-500' key={index}>
                        {item.image && (
                            <img
                                className="bg-blue-50 w-full h-48 object-cover"
                                src={item.image}
                                alt={item.name || "Doctor"}
                            />
                        )}
                        <div className='p-4'>
                            <div className='flex items-center gap-2 text-sm text-center text-green-500'>
                                <p className='text-gray-900 text-lg font-medium'>{item.name}</p>
                                <p className='text-gray-600 text-sm'>{item.speciality}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={() => { router.push('/doctors'); window.scrollTo(0, 0) }} className='bg-blue-50 text-gray-600 px-12 py-3 rounded-full mt-10'>more</button>
        </div>
    )
}

export default RelatedDoctors
