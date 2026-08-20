'use client'

import React, { useEffect, useState } from 'react'
import { doctorDashboard, appointmentComplete, appointmentCancelDoctor } from '@/app/actions/doctorActions'
import { toast } from 'react-toastify'
import { IndianRupee, CalendarCheck, Users, ListChecks, Check, X, Clock } from 'lucide-react'
import { formatINR } from '@/lib/currency'
import { avatarFor } from '@/lib/avatar'
import { appointmentStatus, formatSlotDate, STATUS_STYLES } from '@/lib/appointment'

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
        { label: 'Earnings', value: formatINR(dashData.earnings), icon: IndianRupee, color: 'from-emerald-500 to-teal-400' },
        { label: 'Appointments', value: dashData.appointments, icon: CalendarCheck, color: 'from-blue-600 to-indigo-500' },
        { label: 'Patients', value: dashData.patients, icon: Users, color: 'from-violet-500 to-fuchsia-400' },
    ]

    return (
        <div className='max-w-6xl'>
            <h1 className='text-2xl font-bold text-gray-900 mb-1'>Welcome back 👋</h1>
            <p className='text-gray-500 mb-6'>Here's what's happening with your practice today.</p>

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
                            <img className='rounded-full w-11 h-11 object-cover bg-blue-50' src={avatarFor(item.user.image, item.user.gender)} alt="" />
                            <div className='flex-1 min-w-0 text-sm'>
                                <p className='text-gray-800 font-semibold truncate'>{item.user.name}</p>
                                <p className='text-gray-400 flex items-center gap-1.5 mt-0.5'><Clock className='w-3.5 h-3.5' /> {formatSlotDate(item.slotDate)}, {item.slotTime}</p>
                            </div>
                            {(() => {
                                const status = appointmentStatus(item)
                                if (status === 'Scheduled') {
                                    return (
                                        <div className='flex gap-2'>
                                            <button onClick={() => cancelAppointment(item.id)} className='w-9 h-9 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors' aria-label='Cancel'>
                                                <X className='w-4 h-4' />
                                            </button>
                                            <button onClick={() => completeAppointment(item.id)} className='w-9 h-9 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors' aria-label='Complete'>
                                                <Check className='w-4 h-4' />
                                            </button>
                                        </div>
                                    )
                                }
                                return (
                                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUS_STYLES[status]}`}>
                                        {status}
                                    </span>
                                )
                            })()}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Dashboard
