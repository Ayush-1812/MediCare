'use client'

import React, { useEffect, useState } from 'react'
import { allDoctors, changeAvailability } from '@/app/actions/adminActions'
import { toast } from 'react-toastify'
import { ToggleLeft, ToggleRight } from 'lucide-react'

const DoctorsList = () => {
    const [doctors, setDoctors] = useState<any[]>([])

    const getDoctors = async () => {
        const res = await allDoctors()
        if (res.success && res.doctors) {
            setDoctors(res.doctors)
        } else {
            toast.error(res.message)
        }
    }

    const handleAvailability = async (id: string) => {
        const res = await changeAvailability(id)
        if (res.success) {
            toast.success(res.message)
            getDoctors()
        } else {
            toast.error(res.message)
        }
    }

    useEffect(() => {
        getDoctors()
    }, [])

    return (
        <div className='max-w-6xl'>
            <h1 className='text-2xl font-bold text-gray-900 mb-1'>All Doctors</h1>
            <p className='text-gray-500 mb-6'>Toggle availability for platform-wide bookings.</p>

            <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'>
                {doctors.map((item, index) => (
                    <div className='bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300' key={item.id ?? index}>
                        <img className='w-full h-36 object-cover bg-blue-50' src={item.image || "/assets/profile_pic.png"} alt="" />
                        <div className='p-4'>
                            <p className='text-gray-900 font-semibold truncate'>{item.name}</p>
                            <p className='text-gray-400 text-xs mb-3 truncate'>{item.speciality}</p>
                            <button
                                onClick={() => handleAvailability(item.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${item.available ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-gray-50 border-gray-100 text-gray-500'}`}
                            >
                                {item.available ? 'Available' : 'Unavailable'}
                                {item.available ? <ToggleRight className='w-6 h-6 text-emerald-500' /> : <ToggleLeft className='w-6 h-6 text-gray-400' />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default DoctorsList
