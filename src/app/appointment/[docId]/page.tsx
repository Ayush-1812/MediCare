'use client'

import React, { useContext, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppContext } from '@/context/AppContext'
import { bookAppointment } from '@/app/actions/userActions'
import { toast } from 'react-toastify'
import RelatedDoctors from '@/components/RelatedDoctors'

type Slot = {
    datetime: Date
    time: string
}

const Appointment = () => {
    const { docId } = useParams<{ docId: string }>()
    const { doctors, token, getDoctorsData } = useContext(AppContext)
    const router = useRouter()

    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

    const [docInfo, setDocInfo] = useState<any>(null)
    const [docSlots, setDocSlots] = useState<Slot[][]>([])
    const [slotIndex, setSlotIndex] = useState<number>(0)
    const [slotTime, setSlotTime] = useState<string>('')

    const fetchDocInfo = () => {
        const doc = doctors.find((doc: any) => doc.id === docId)
        setDocInfo(doc)
    }

    const getAvailableSlots = () => {
        setDocSlots([])
        const today = new Date()

        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(today)
            currentDate.setDate(today.getDate() + i)

            const endTime = new Date(currentDate)
            endTime.setHours(21, 0, 0, 0)

            if (today.getDate() === currentDate.getDate()) {
                currentDate.setHours(currentDate.getHours() > 10 ? currentDate.getHours() + 1 : 10)
                currentDate.setMinutes(currentDate.getMinutes() > 30 ? 30 : 0)
            } else {
                currentDate.setHours(10, 0, 0, 0)
            }

            const timeSlots: Slot[] = []

            while (currentDate < endTime) {
                const formattedTime = currentDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                })

                const day = currentDate.getDate()
                const month = currentDate.getMonth() + 1
                const year = currentDate.getFullYear()

                const slotDate = `${day}_${month}_${year}`

                const isSlotAvailable =
                    !docInfo?.slots_booked?.[slotDate]?.includes(formattedTime)

                if (isSlotAvailable) {
                    timeSlots.push({
                        datetime: new Date(currentDate),
                        time: formattedTime
                    })
                }

                currentDate.setMinutes(currentDate.getMinutes() + 30)
            }

            setDocSlots(prev => [...prev, timeSlots])
        }
    }

    const handleBookAppointment = async () => {
        if (!token) {
            toast.warn('Login to book appointment')
            router.push('/login')
            return
        }

        try {
            const date = docSlots[slotIndex][0].datetime
            const day = date.getDate()
            const month = date.getMonth() + 1
            const year = date.getFullYear()

            const slotDate = `${day}_${month}_${year}`

            const res = await bookAppointment(docId, slotDate, slotTime)

            if (res.success) {
                toast.success(res.message)
                getDoctorsData()
                router.push('/my-appointments')
            } else {
                toast.error(res.message)
            }
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    useEffect(() => {
        fetchDocInfo()
    }, [doctors, docId])

    useEffect(() => {
        if (docInfo) {
            getAvailableSlots()
        }
    }, [docInfo])

    if (!docInfo) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center font-medium">
                Loading...
            </div>
        )
    }

    return (
        <div>
            {/* Doctor Details */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div>
                    <img
                        className="bg-primary w-full sm:max-w-72 rounded-lg"
                        src={docInfo.image?.trim() ? docInfo.image : '/assets/profile_pic.png'}
                        alt="Doctor"
                    />
                </div>

                <div className="flex-1 border border-gray-400 rounded-lg p-8 py-7 bg-white mx-2 sm:mx-0 mt-[-80px] sm:mt-0">
                    <p className="flex items-center gap-2 text-2xl font-medium text-gray-900">
                        {docInfo.name}
                        <img className="w-5" src="/assets/verified_icon.svg" alt="" />
                    </p>

                    <div className="flex items-center gap-2 text-sm mt-1 text-gray-600">
                        <p>{docInfo.degree} - {docInfo.speciality}</p>
                        <button className="py-0.5 px-2 border text-xs rounded-full">
                            {docInfo.experience}
                        </button>
                    </div>

                    <div>
                        <p className="flex items-center gap-1 text-sm font-medium text-gray-900 mt-3">
                            About <img className="w-3" src="/assets/info_icon.svg" alt="" />
                        </p>
                        <p className="text-sm text-gray-500 max-w-[700px] mt-1">
                            {docInfo.about}
                        </p>
                    </div>

                    <p className="text-gray-500 font-medium mt-4">
                        Appointment fee: <span className="text-gray-800">${docInfo.fees}</span>
                    </p>
                </div>
            </div>

            {/* Booking Slots */}
            <div className="sm:ml-72 sm:pl-4 mt-4 font-medium text-gray-700">
                <p>Booking slots</p>

                <div className="flex gap-3 items-center w-full overflow-x-scroll mt-4">
                    {docSlots.map((slots: Slot[], index: number) => (
                        <div
                            key={index}
                            onClick={() => setSlotIndex(index)}
                            className={`text-center py-6 min-w-16 rounded-full cursor-pointer ${slotIndex === index
                                ? 'bg-primary text-white'
                                : 'border border-gray-200'
                                }`}
                        >
                            <p>{slots[0] && daysOfWeek[slots[0].datetime.getDay()]}</p>
                            <p>{slots[0] && slots[0].datetime.getDate()}</p>
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full overflow-x-scroll mt-4">
                    {docSlots[slotIndex]?.map((slot: Slot, index: number) => (
                        <p
                            key={index}
                            onClick={() => setSlotTime(slot.time)}
                            className={`text-sm font-light flex-shrink-0 px-5 py-2 rounded-full cursor-pointer ${slot.time === slotTime
                                ? 'bg-primary text-white'
                                : 'text-gray-400 border border-gray-300'
                                }`}
                        >
                            {slot.time.toLowerCase()}
                        </p>
                    ))}
                </div>

                <button
                    onClick={handleBookAppointment}
                    className="bg-primary text-white text-sm font-light px-14 py-3 rounded-full mt-6"
                >
                    Book an appointment
                </button>
            </div>

            <RelatedDoctors docId={docId} speciality={docInfo.speciality} />
        </div>
    )
}

export default Appointment
