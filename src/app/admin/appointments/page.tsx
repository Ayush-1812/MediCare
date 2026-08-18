'use client'

import React, { useEffect, useState } from 'react'
import { appointmentsAdmin } from '@/app/actions/adminActions'
import { toast } from 'react-toastify'
import { cancelAppointment } from '@/app/actions/userActions'
import { X } from 'lucide-react'

const Appointments = () => {
    const [appointments, setAppointments] = useState<any[]>([])

    const getAppointments = async () => {
        const res = await appointmentsAdmin()
        if (res.success && res.appointments) {
            setAppointments(res.appointments.reverse())
        } else {
            toast.error(res.message)
        }
    }

    const handleCancel = async (id: string) => {
        const res = await cancelAppointment(id)
        if (res.success) {
            toast.success(res.message)
            getAppointments()
        } else {
            toast.error(res.message)
        }
    }

    useEffect(() => {
        getAppointments()
    }, [])

    return (
        <div className='w-full max-w-6xl'>
            <h1 className='text-2xl font-bold text-gray-900 mb-1'>All Appointments</h1>
            <p className='text-gray-500 mb-6'>Platform-wide appointment activity.</p>

            <div className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden'>
                <div className='hidden sm:grid grid-cols-[0.5fr_2.5fr_2fr_2.5fr_1fr_1fr] gap-3 py-3.5 px-6 border-b border-gray-100 bg-gray-50/60 text-xs font-bold text-gray-400 uppercase tracking-wider'>
                    <p>#</p>
                    <p>Patient</p>
                    <p>Date & Time</p>
                    <p>Doctor</p>
                    <p>Fees</p>
                    <p>Actions</p>
                </div>

                <div className='divide-y divide-gray-50 max-h-[65vh] overflow-y-auto custom-scrollbar'>
                    {appointments.length === 0 ? (
                        <p className='text-center text-gray-400 py-14 text-sm'>No appointments found.</p>
                    ) : appointments.map((item, index) => (
                        <div className='flex flex-wrap sm:grid grid-cols-[0.5fr_2.5fr_2fr_2.5fr_1fr_1fr] gap-3 items-center text-gray-600 py-4 px-6 hover:bg-gray-50/70 transition-colors' key={item.id ?? index}>
                            <p className='max-sm:hidden text-gray-400 font-medium'>{index + 1}</p>
                            <div className='flex items-center gap-3'>
                                <img className='w-9 h-9 rounded-full object-cover bg-blue-50' src={item.user.image || "/assets/profile_pic.png"} alt="" />
                                <p className='font-semibold text-gray-800 truncate'>{item.user.name}</p>
                            </div>
                            <p className='text-sm'>{item.slotDate}, {item.slotTime}</p>
                            <div className='flex items-center gap-3'>
                                <img className='w-9 h-9 rounded-full object-cover bg-gray-100' src={item.doctor.image || "/assets/profile_pic.png"} alt="" />
                                <p className='truncate'>{item.doctor.name}</p>
                            </div>
                            <p className='font-semibold text-gray-800'>${item.amount}</p>
                            {item.cancelled ? (
                                <span className='text-red-500 bg-red-50 text-xs font-semibold px-3 py-1.5 rounded-full w-fit'>Cancelled</span>
                            ) : item.isCompleted ? (
                                <span className='text-emerald-600 bg-emerald-50 text-xs font-semibold px-3 py-1.5 rounded-full w-fit'>Completed</span>
                            ) : (
                                <button onClick={() => handleCancel(item.id)} className='w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors' aria-label='Cancel'>
                                    <X className='w-4 h-4' />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Appointments
