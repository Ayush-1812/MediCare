'use client'

import React, { useEffect, useState } from 'react'
import { adminDashboard } from '@/app/actions/adminActions'
import { toast } from 'react-toastify'
import { avatarFor } from '@/lib/avatar'
import { Stethoscope, CalendarCheck, Users, ListChecks, Clock, CalendarClock } from 'lucide-react'

const Dashboard = () => {
    const [dashData, setDashData] = useState<any>(null)

    const getDashData = async () => {
        const res = await adminDashboard()
        if (res.success) {
            setDashData(res.dashData)
        } else {
            toast.error(res.message)
        }
    }

    useEffect(() => {
        getDashData()
    }, [])

    if (!dashData) {
        return (
            <div className='flex items-center justify-center min-h-[60vh]'>
                <div className='flex items-center gap-2 text-primary font-medium'>
                    <span className='w-2 h-2 bg-primary rounded-full animate-bounce'></span>
                    <span className='w-2 h-2 bg-primary rounded-full animate-bounce' style={{ animationDelay: '0.15s' }}></span>
                    <span className='w-2 h-2 bg-primary rounded-full animate-bounce' style={{ animationDelay: '0.3s' }}></span>
                </div>
            </div>
        )
    }

    const stats = [
        { label: 'Doctors', value: dashData.doctors, icon: Stethoscope, color: 'from-blue-600 to-indigo-500' },
        { label: 'Appointments', value: dashData.appointments, icon: CalendarCheck, color: 'from-emerald-500 to-teal-400' },
        { label: 'Patients', value: dashData.patients, icon: Users, color: 'from-violet-500 to-fuchsia-400' },
    ]

    return (
        <div className='max-w-6xl'>
            <h1 className='text-2xl font-bold text-gray-900 mb-1'>Admin Overview</h1>
            <p className='text-gray-500 mb-6'>Platform-wide activity at a glance.</p>

            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                {stats.map((s) => (
                    <div key={s.label} className='bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4'>
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${s.color} flex items-center justify-center text-white shadow-sm shrink-0`}>
                            <s.icon className='w-6 h-6' />
                        </div>
                        <div>
                            <p className='text-2xl font-bold text-gray-900'>{s.value}</p>
                            <p className='text-gray-400 text-sm font-medium'>{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className='bg-white mt-8 rounded-2xl border border-gray-100 shadow-sm overflow-hidden'>
                <div className='flex items-center gap-2.5 px-6 py-4 border-b border-gray-100 bg-gray-50/60'>
                    <ListChecks className='w-5 h-5 text-primary' />
                    <p className='font-semibold text-gray-800'>Latest Bookings</p>
                </div>

                <div className='divide-y divide-gray-50'>
                    {dashData.latestAppointments.length === 0 ? (
                        <p className='text-center text-gray-400 py-10 text-sm'>No bookings yet.</p>
                    ) : dashData.latestAppointments.map((item: any, index: number) => (
                        <div className='flex items-center px-6 py-4 gap-4 hover:bg-gray-50/70 transition-colors' key={index}>
                            <img className='rounded-full w-11 h-11 object-cover bg-blue-50' src={avatarFor(item.doctor.image, item.doctor.gender)} alt="" />
                            <div className='flex-1 min-w-0 text-sm'>
                                <p className='text-gray-800 font-semibold truncate'>{item.doctor.name}</p>
                                <p className='text-gray-400 flex items-center gap-1.5 mt-0.5'><Clock className='w-3.5 h-3.5' /> {item.slotDate}</p>
                            </div>
                            {item.cancelled ? (
                                <span className='text-red-500 bg-red-50 text-xs font-semibold px-3 py-1.5 rounded-full'>Cancelled</span>
                            ) : item.isCompleted ? (
                                <span className='text-emerald-600 bg-emerald-50 text-xs font-semibold px-3 py-1.5 rounded-full'>Completed</span>
                            ) : (
                                <span className='text-blue-600 bg-blue-50 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1'>
                                    <CalendarClock className='w-3 h-3' /> Upcoming
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Dashboard
