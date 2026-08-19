'use client'

import React, { useEffect, useState } from 'react'
import { appointmentsDoctor, appointmentComplete, appointmentCancelDoctor, startVideoCall } from '@/app/actions/doctorActions'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import { Video, Check, X, CreditCard, Banknote } from 'lucide-react'
import { formatINR } from '@/lib/currency'
import { avatarFor } from '@/lib/avatar'

const Appointments = () => {
    const [appointments, setAppointments] = useState<any[]>([])
    const router = useRouter()

    const getAppointments = async () => {
        const res = await appointmentsDoctor()
        if (res.success) {
            // Already newest-first from the server; `.reverse()` here mutated that array
            // and flipped it back to oldest-first.
            setAppointments(res.appointments)
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
        <div className='w-full max-w-6xl'>
            <h1 className='text-2xl font-bold text-gray-900 mb-1'>Appointments</h1>
            <p className='text-gray-500 mb-6'>Manage your upcoming and past consultations.</p>

            <div className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden'>
                <div className='hidden sm:grid grid-cols-[0.5fr_2.5fr_1fr_2fr_1fr_1.5fr] gap-3 py-3.5 px-6 border-b border-gray-100 bg-gray-50/60 text-xs font-bold text-gray-400 uppercase tracking-wider'>
                    <p>#</p>
                    <p>Patient</p>
                    <p>Payment</p>
                    <p>Date & Time</p>
                    <p>Fees</p>
                    <p>Actions</p>
                </div>

                <div className='divide-y divide-gray-50 max-h-[65vh] overflow-y-auto custom-scrollbar'>
                    {appointments.length === 0 ? (
                        <p className='text-center text-gray-400 py-14 text-sm'>No appointments found.</p>
                    ) : appointments.map((item, index) => (
                        <div className='flex flex-wrap sm:grid grid-cols-[0.5fr_2.5fr_1fr_2fr_1fr_1.5fr] gap-3 items-center text-gray-600 py-4 px-6 hover:bg-gray-50/70 transition-colors' key={item.id ?? index}>
                            <p className='max-sm:hidden text-gray-400 font-medium'>{index + 1}</p>
                            <div className='flex items-center gap-3'>
                                <img className='w-9 h-9 rounded-full object-cover bg-blue-50' src={avatarFor(item.user.image, item.user.gender)} alt="" />
                                <p className='font-semibold text-gray-800 truncate'>{item.user.name}</p>
                            </div>
                            <div>
                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${item.payment ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                    {item.payment ? <CreditCard className='w-3 h-3' /> : <Banknote className='w-3 h-3' />}
                                    {item.payment ? 'ONLINE' : 'CASH'}
                                </span>
                            </div>
                            <p className='text-sm'>{item.slotDate}, {item.slotTime}</p>
                            <p className='font-semibold text-gray-800'>{formatINR(item.amount)}</p>
                            {item.cancelled ? (
                                <span className='text-red-500 bg-red-50 text-xs font-semibold px-3 py-1.5 rounded-full w-fit'>Cancelled</span>
                            ) : item.isCompleted ? (
                                <span className='text-emerald-600 bg-emerald-50 text-xs font-semibold px-3 py-1.5 rounded-full w-fit'>Completed</span>
                            ) : (
                                <div className='flex gap-2'>
                                    <button onClick={() => handleVideoCall(item.id)} className='text-xs bg-primary text-white px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 hover:bg-primary/90 hover:-translate-y-0.5 transition-all shadow-sm'>
                                        <Video className='w-3.5 h-3.5' /> Call
                                    </button>
                                    <button onClick={() => cancelAppointment(item.id)} className='w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors' aria-label='Cancel'>
                                        <X className='w-4 h-4' />
                                    </button>
                                    <button onClick={() => completeAppointment(item.id)} className='w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors' aria-label='Complete'>
                                        <Check className='w-4 h-4' />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Appointments
