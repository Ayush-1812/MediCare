'use client'

import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '@/context/AppContext'
import { cancelAppointment, listAppointments } from '@/app/actions/userActions'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import { getMeetingId } from '@/app/actions/doctorActions'

const MyAppointments = () => {
    const { token } = useContext(AppContext)
    const [appointments, setAppointments] = useState<any[]>([])
    const router = useRouter()

    const getAppointments = async () => {
        try {
            const res = await listAppointments()
            if (res.success && res.appointments) {
                setAppointments(res.appointments.reverse())
            }
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const handleCancelAppointment = async (id: string) => {
        try {
            const res = await cancelAppointment(id)
            if (res.success) {
                toast.success(res.message)
                getAppointments()
            } else {
                toast.error(res.message)
            }
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    useEffect(() => {
        if (token) {
            getAppointments()
        }
    }, [token])

    return (
        <div>
            <p className='pb-3 mt-12 font-medium text-zinc-700 border-b italic'>My Appointments</p>
            <div>
                {appointments.map((item, index) => (
                    <div className='grid grid-cols-[1fr_2fr] gap-4 sm:flex sm:gap-6 py-2 border-b' key={index}>
                        <div>
                            {/* <img className='w-32 bg-indigo-50' src={item.docData.image} alt="" /> */}
                            {item.docData.image && (
                                <img
                                    className="w-32 bg-indigo-50"
                                    src={item.docData.image}
                                    alt={item.docData.name || "Doctor"}
                                />
                            )}

                        </div>
                        <div className='flex-1 text-sm text-zinc-600'>
                            <p className='text-neutral-800 font-semibold'>{item.docData?.name}</p>
                            <p>{item.docData?.speciality}</p>
                            <p className='text-zinc-700 font-medium mt-1'>Address:</p>
                            <p className='text-xs'>{item.docData?.address?.line1}</p>
                            <p className='text-xs'>{item.docData?.address?.line2}</p>
                            <p className='text-sm mt-1'><span className='text-sm text-neutral-700 font-medium'>Date & Time:</span> {item.slotDate} | {item.slotTime}</p>
                        </div>
                        <div></div>
                        <div className='flex flex-col gap-2 justify-end'>
                            {!item.cancelled && !item.isCompleted && item.payment && (
                                <button className='sm:min-w-48 py-2 border border-green-500 rounded text-green-500'>Paid</button>
                            )}
                            {!item.cancelled && !item.isCompleted && item.meetingId && (
                                <button onClick={() => router.push(`/video-call/${item.id}`)} className='text-sm text-white text-center sm:min-w-48 py-2 border rounded bg-primary hover:opacity-90 transition-all duration-300'>Join Video Call</button>
                            )}
                            {!item.cancelled && !item.isCompleted && (
                                <button onClick={() => handleCancelAppointment(item.id)} className='text-sm text-stone-500 text-center sm:min-w-48 py-2 border rounded hover:bg-red-600 hover:text-white transition-all duration-300'>Cancel Appointment</button>
                            )}
                            {item.cancelled && !item.isCompleted && (
                                <button className='sm:min-w-48 py-2 border border-red-500 rounded text-red-500'>Appointment Cancelled</button>
                            )}
                            {item.isCompleted && (
                                <button className='sm:min-w-48 py-2 border border-green-500 rounded text-green-500'>Completed</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default MyAppointments
