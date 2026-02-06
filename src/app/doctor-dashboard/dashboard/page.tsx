'use client'

import React, { useEffect, useState } from 'react'
import { doctorDashboard, appointmentComplete, appointmentCancelDoctor } from '@/app/actions/doctorActions'
import { toast } from 'react-toastify'

const Dashboard = () => {
    const [dashData, setDashData] = useState<any>(null)

    const getDashData = async () => {
        const res = await doctorDashboard()
        if (res.success) {
            setDashData(res.dashData)
        } else {
            toast.error(res.message)
        }
    }

    const completeAppointment = async (id: string) => {
        const res = await appointmentComplete(id)
        if (res.success) {
            toast.success(res.message)
            getDashData()
        } else {
            toast.error(res.message)
        }
    }

    const cancelAppointment = async (id: string) => {
        const res = await appointmentCancelDoctor(id)
        if (res.success) {
            toast.success(res.message)
            getDashData()
        } else {
            toast.error(res.message)
        }
    }

    useEffect(() => {
        getDashData()
    }, [])

    if (!dashData) return <div>Loading...</div>

    return (
        <div className='m-5'>
            <div className='flex flex-wrap gap-3'>
                <div className='flex items-center gap-2 bg-white p-4 min-w-52 rounded border-2 border-gray-100 cursor-pointer hover:scale-105 transition-all'>
                    <img className='w-14' src="/assets/earning_icon.svg" alt="" />
                    <div>
                        <p className='text-xl font-semibold text-gray-600'>${dashData.earnings}</p>
                        <p className='text-gray-400'>Earnings</p>
                    </div>
                </div>
                <div className='flex items-center gap-2 bg-white p-4 min-w-52 rounded border-2 border-gray-100 cursor-pointer hover:scale-105 transition-all'>
                    <img className='w-14' src="/assets/appointments_icon.svg" alt="" />
                    <div>
                        <p className='text-xl font-semibold text-gray-600'>{dashData.appointments}</p>
                        <p className='text-gray-400'>Appointments</p>
                    </div>
                </div>
                <div className='flex items-center gap-2 bg-white p-4 min-w-52 rounded border-2 border-gray-100 cursor-pointer hover:scale-105 transition-all'>
                    <img className='w-14' src="/assets/patients_icon.svg" alt="" />
                    <div>
                        <p className='text-xl font-semibold text-gray-600'>{dashData.patients}</p>
                        <p className='text-gray-400'>Patients</p>
                    </div>
                </div>
            </div>

            <div className='bg-white mt-10'>
                <div className='flex items-center gap-2.5 px-4 py-4 mt-10 rounded-t border'>
                    <img src="/assets/list_icon.svg" alt="" />
                    <p className='font-semibold'>Latest Bookings</p>
                </div>

                <div className='pt-4 border border-t-0'>
                    {dashData.latestAppointments.map((item: any, index: number) => (
                        <div className='flex items-center px-6 py-3 gap-3 hover:bg-gray-100' key={index}>
                            <img className='rounded-full w-10' src={item.user.image || "/assets/profile_pic.png"} alt="" />
                            <div className='flex-1 text-sm'>
                                <p className='text-gray-800 font-medium'>{item.user.name}</p>
                                <p className='text-gray-600'>{item.slotDate}</p>
                            </div>
                            {item.cancelled ? (
                                <p className='text-red-400 text-xs font-medium'>Cancelled</p>
                            ) : item.isCompleted ? (
                                <p className='text-green-500 text-xs font-medium'>Completed</p>
                            ) : (
                                <div className='flex gap-2'>
                                    <img onClick={() => cancelAppointment(item.id)} className='w-10 cursor-pointer' src="/assets/cancel_icon.svg" alt="" />
                                    <img onClick={() => completeAppointment(item.id)} className='w-10 cursor-pointer' src="/assets/tick_icon.svg" alt="" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Dashboard
