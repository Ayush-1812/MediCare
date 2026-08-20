'use client'

import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '@/context/AppContext'
import { cancelAppointment, listAppointments } from '@/app/actions/userActions'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import { CalendarDays, MapPin, Video, XCircle, CheckCircle2, CreditCard, AlertTriangle, Clock } from 'lucide-react'
import { avatarFor } from '@/lib/avatar'
import { appointmentStatus, formatSlotDate } from '@/lib/appointment'

const MyAppointments = () => {
    const { token } = useContext(AppContext)
    const [appointments, setAppointments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    const getAppointments = async () => {
        try {
            const res = await listAppointments()
            if (res.success) {
                // Server already returns these newest-first; `.reverse()` undid that.
                setAppointments(res.appointments)
            } else {
                toast.error(res.message)
            }
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
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
        <div className='min-h-screen pb-16'>
            <div className='mt-8 mb-6'>
                <h1 className='text-2xl sm:text-3xl font-bold text-gray-900'>My Appointments</h1>
                <p className='text-gray-500 mt-1'>Track your upcoming and past consultations.</p>
            </div>

            {loading ? (
                <div className='flex items-center gap-2 text-primary font-medium py-16 justify-center'>
                    <span className='w-2 h-2 bg-primary rounded-full animate-bounce'></span>
                    <span className='w-2 h-2 bg-primary rounded-full animate-bounce' style={{ animationDelay: '0.15s' }}></span>
                    <span className='w-2 h-2 bg-primary rounded-full animate-bounce' style={{ animationDelay: '0.3s' }}></span>
                </div>
            ) : appointments.length === 0 ? (
                <div className='flex flex-col items-center justify-center text-center py-20 bg-blue-50/40 rounded-3xl border border-dashed border-blue-100'>
                    <CalendarDays className='w-10 h-10 text-blue-300 mb-3' />
                    <p className='text-gray-600 font-medium'>You have no appointments yet.</p>
                    <button onClick={() => router.push('/doctors')} className='mt-4 bg-primary text-white px-6 py-2.5 rounded-full font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all'>
                        Find a Doctor
                    </button>
                </div>
            ) : (
                <div className='flex flex-col gap-4'>
                    {appointments.map((item, index) => (
                        <div className='bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-5 flex flex-col sm:flex-row gap-5' key={item.id ?? index}>
                            <img
                                className="w-full sm:w-32 h-32 rounded-xl object-cover bg-blue-50 shrink-0"
                                src={avatarFor(item.docData?.image ?? item.doctor?.image, item.doctor?.gender)}
                                alt={item.docData?.name || "Doctor"}
                            />

                            <div className='flex-1 min-w-0'>
                                <p className='text-gray-900 font-bold text-lg'>{item.docData?.name}</p>
                                <p className='text-primary text-sm font-medium mb-2'>{item.docData?.speciality}</p>

                                {(item.docData?.address?.line1 || item.docData?.address?.line2) && (
                                    <p className='text-sm text-gray-500 flex items-start gap-1.5 mb-1.5'>
                                        <MapPin className='w-4 h-4 shrink-0 mt-0.5 text-gray-400' />
                                        <span>{item.docData?.address?.line1}{item.docData?.address?.line1 && item.docData?.address?.line2 ? ', ' : ''}{item.docData?.address?.line2}</span>
                                    </p>
                                )}

                                <p className='text-sm text-gray-600 flex items-center gap-1.5 font-medium'>
                                    <CalendarDays className='w-4 h-4 text-gray-400' /> {formatSlotDate(item.slotDate)} &middot; {item.slotTime}
                                </p>
                            </div>

                            <div className='flex sm:flex-col gap-2 justify-center sm:min-w-[190px]'>
                                {(() => {
                                    // Status is derived, not read off a single flag: an appointment
                                    // whose slot has passed without being completed is a no-show,
                                    // and must not keep offering "Join call" or "Cancel".
                                    const status = appointmentStatus(item)

                                    if (status === 'Scheduled') {
                                        return (
                                            <>
                                                {item.payment && (
                                                    <span className='flex items-center justify-center gap-1.5 py-2.5 border border-emerald-200 bg-emerald-50 rounded-xl text-emerald-600 text-sm font-semibold'>
                                                        <CreditCard className='w-4 h-4' /> Paid
                                                    </span>
                                                )}
                                                {item.meetingId && (
                                                    <button onClick={() => router.push(`/video-call/${item.id}`)} className='flex items-center justify-center gap-1.5 text-sm text-white text-center py-2.5 rounded-xl bg-primary hover:bg-primary/90 hover:-translate-y-0.5 transition-all shadow-sm font-semibold'>
                                                        <Video className='w-4 h-4' /> Join Video Call
                                                    </button>
                                                )}
                                                <button onClick={() => handleCancelAppointment(item.id)} className='flex items-center justify-center gap-1.5 text-sm text-gray-500 text-center py-2.5 rounded-xl border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all font-semibold'>
                                                    <XCircle className='w-4 h-4' /> Cancel Appointment
                                                </button>
                                            </>
                                        )
                                    }

                                    if (status === 'Cancelled') {
                                        return (
                                            <span className='flex items-center justify-center gap-1.5 py-2.5 border border-red-200 bg-red-50 rounded-xl text-red-600 text-sm font-semibold'>
                                                <XCircle className='w-4 h-4' /> Cancelled
                                            </span>
                                        )
                                    }

                                    if (status === 'Completed') {
                                        return (
                                            <span className='flex items-center justify-center gap-1.5 py-2.5 border border-emerald-200 bg-emerald-50 rounded-xl text-emerald-600 text-sm font-semibold'>
                                                <CheckCircle2 className='w-4 h-4' /> Completed
                                            </span>
                                        )
                                    }

                                    return (
                                        <>
                                            <span className='flex items-center justify-center gap-1.5 py-2.5 border border-amber-200 bg-amber-50 rounded-xl text-amber-600 text-sm font-semibold'>
                                                <AlertTriangle className='w-4 h-4' /> Missed
                                            </span>
                                            <button onClick={() => router.push(`/doctors`)} className='flex items-center justify-center gap-1.5 text-sm text-gray-500 py-2.5 rounded-xl border border-gray-200 hover:bg-blue-50 hover:text-primary hover:border-blue-200 transition-all font-semibold'>
                                                <Clock className='w-4 h-4' /> Rebook
                                            </button>
                                        </>
                                    )
                                })()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default MyAppointments
