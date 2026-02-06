'use client'

import React, { useEffect, useState } from 'react'
import { appointmentsDoctor, appointmentComplete, appointmentCancelDoctor, startVideoCall } from '@/app/actions/doctorActions'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'

const Appointments = () => {
    const [appointments, setAppointments] = useState<any[]>([])
    const router = useRouter()

    const getAppointments = async () => {
        const res = await appointmentsDoctor()
        if (res.success && res.appointments) {
            setAppointments(res.appointments.reverse())
        } else {
            toast.error(res.message)
        }
    }

    const completeAppointment = async (id: string) => {
        const res = await appointmentComplete(id)
        if (res.success) {
            toast.success(res.message)
            getAppointments()
        } else {
            toast.error(res.message)
        }
    }

    const cancelAppointment = async (id: string) => {
        const res = await appointmentCancelDoctor(id)
        if (res.success) {
            toast.success(res.message)
            getAppointments()
        } else {
            toast.error(res.message)
        }
    }

    const handleVideoCall = async (id: string) => {
        const res = await startVideoCall(id)
        if (res.success) {
            router.push(`/video-call/${id}`)
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
            <div className='bg-white border rounded text-sm max-h-[80vh] min-h-[50vh] overflow-y-scroll'>
                <div className='max-sm:hidden grid grid-cols-[0.5fr_3fr_1fr_3fr_3fr_1fr_1fr] grid-flow-col py-3 px-6 border-b font-medium'>
                    <p>#</p>
                    <p>Patient</p>
                    <p>Payment</p>
                    <p>Age</p>
                    <p>Date & Time</p>
                    <p>Fees</p>
                    <p>Actions</p>
                </div>

                {appointments.map((item, index) => (
                    <div className='flex flex-wrap justify-between sm:grid grid-cols-[0.5fr_3fr_1fr_3fr_3fr_1fr_1fr] items-center text-gray-500 py-3 px-6 border-b hover:bg-gray-50' key={index}>
                        <p className='max-sm:hidden'>{index + 1}</p>
                        <div className='flex items-center gap-2'>
                            <img className='w-8 rounded-full' src={item.user.image || "/assets/profile_pic.png"} alt="" /> <p>{item.user.name}</p>
                        </div>
                        <div>
                            <p className='text-xs inline border border-primary px-2 rounded-full'>
                                {item.payment ? 'ONLINE' : 'CASH'}
                            </p>
                        </div>
                        <p className='max-sm:hidden'>20</p>
                        <p>{item.slotDate}, {item.slotTime}</p>
                        <p>${item.amount}</p>
                        {item.cancelled ? (
                            <p className='text-red-400 text-xs font-medium'>Cancelled</p>
                        ) : item.isCompleted ? (
                            <p className='text-green-500 text-xs font-medium'>Completed</p>
                        ) : (
                            <div className='flex gap-2'>
                                {!item.cancelled && !item.isCompleted && (
                                    <button onClick={() => handleVideoCall(item.id)} className='text-xs bg-primary text-white px-2 py-1 rounded'>Start Call</button>
                                )}
                                <img onClick={() => cancelAppointment(item.id)} className='w-10 cursor-pointer' src="/assets/cancel_icon.svg" alt="" />
                                <img onClick={() => completeAppointment(item.id)} className='w-10 cursor-pointer' src="/assets/tick_icon.svg" alt="" />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Appointments
