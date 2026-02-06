'use client'

import React, { useContext, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppContext } from '@/context/AppContext'
import { specialityData } from '@/lib/constants'

const Doctors = () => {
    const { speciality } = useParams()
    const router = useRouter()
    const { doctors } = useContext(AppContext)
    const [filterDoc, setFilterDoc] = useState<any[]>([])
    const [showFilter, setShowFilter] = useState(false)

    const applyFilter = () => {
        if (speciality) {
            setFilterDoc(doctors.filter((doc: any) => doc.speciality === decodeURIComponent(speciality as string)))
        } else {
            setFilterDoc(doctors)
        }
    }

    useEffect(() => {
        applyFilter()
    }, [doctors, speciality])

    return (
        <div>
            <p className='text-gray-600'>Browse through the doctors specialist.</p>
            <div className='flex flex-col sm:flex-row items-start gap-5 mt-5'>
                <button onClick={() => setShowFilter(!showFilter)} className={`py-1 px-3 border rounded text-sm transition-all sm:hidden ${showFilter ? 'bg-primary text-white' : ''}`}>Filters</button>
                <div className={`flex-col gap-4 text-sm text-gray-600 ${showFilter ? 'flex' : 'hidden sm:flex'}`}>
                    {specialityData.map((item, index) => (
                        <p key={index} onClick={() => speciality === item.speciality ? router.push('/doctors') : router.push(`/doctors/${item.speciality}`)} className={`w-[94vw] sm:w-auto pl-3 py-1.5 pr-16 border border-gray-300 rounded transition-all cursor-pointer ${speciality === item.speciality ? 'bg-indigo-100 text-black' : ''}`}>
                            {item.speciality}
                        </p>
                    ))}
                </div>
                <div className='w-full grid grid-cols-auto gap-4 gap-y-6' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                    {filterDoc.map((item, index) => (
                        <div onClick={() => router.push(`/appointment/${item.id}`)} className='border border-blue-200 rounded-xl overflow-hidden cursor-pointer hover:translate-y-[-10px] transition-all duration-500' key={index}>
                            <img className='bg-blue-50 w-full h-48 object-cover' src={item.image} alt="" />
                            <div className='p-4'>
                                <div className='flex items-center gap-2 text-sm text-center text-green-500'>
                                    <p className='w-2 h-2 bg-green-500 rounded-full'></p><p>Available</p>
                                </div>
                                <p className='text-gray-900 text-lg font-medium'>{item.name}</p>
                                <p className='text-gray-600 text-sm'>{item.speciality}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Doctors
