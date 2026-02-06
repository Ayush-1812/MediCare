'use client'

import React, { useEffect, useState } from 'react'
import { appointmentsAdmin } from '@/app/actions/adminActions'
import { toast } from 'react-toastify'
import { cancelAppointment } from '@/app/actions/userActions'

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
        <div className='w-full max-w-6xl m-5'>
            <p className='mb-3 text-lg font-medium'>All Appointments</p>
            <div className='bg-white border rounded text-sm max-h-[80vh] min-h-[60vh] overflow-y-scroll'>
                <div className='hidden sm:grid grid-cols-[0.5fr_3fr_1fr_3fr_3fr_1fr_1fr] grid-flow-col py-3 px-6 border-b'>
                    <p>#</p>
                    <p>Patient</p>
                    <p>Age</p>
                    <p>Date & Time</p>
                    <p>Doctor</p>
                    <p>Fees</p>
                    <p>Actions</p>
                </div>

                {appointments.map((item, index) => (
                    <div className='flex flex-wrap justify-between sm:grid grid-cols-[0.5fr_3fr_1fr_3fr_3fr_1fr_1fr] items-center text-gray-500 py-3 px-6 border-b hover:bg-gray-50' key={index}>
                        <p className='max-sm:hidden'>{index + 1}</p>
                        <div className='flex items-center gap-2'>
                            <img className='w-8 rounded-full' src={item.user.image || "/assets/profile_pic.png"} alt="" /> <p>{item.user.name}</p>
                        </div>
                        <p className='max-sm:hidden'>20</p>
                        <p>{item.slotDate}, {item.slotTime}</p>
                        <div className='flex items-center gap-2'>
                            <img className='w-8 rounded-full bg-gray-200' src={item.doctor.image} alt="" /> <p>{item.doctor.name}</p>
                        </div>
                        <p>${item.amount}</p>
                        {item.cancelled ? (
                            <p className='text-red-400 text-xs font-medium'>Cancelled</p>
                        ) : item.isCompleted ? (
                            <p className='text-green-500 text-xs font-medium'>Completed</p>
                        ) : (
                            <img onClick={() => handleCancel(item.id)} className='w-10 cursor-pointer' src="/assets/cancel_icon.svg" alt="" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Appointments
