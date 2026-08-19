'use client'

import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppContext } from '@/context/AppContext'
import { bookAppointment } from '@/app/actions/userActions'
import { toast } from 'react-toastify'
import RelatedDoctors from '@/components/RelatedDoctors'
import { formatINR } from '@/lib/currency'
import { avatarFor } from '@/lib/avatar'
import {
    BOOKING_WINDOW_DAYS,
    formatSlotDateKey,
    generateSlots,
    parseAvailableDays,
    WEEKDAYS,
    type Slot,
} from '@/lib/schedule'
import {
    BadgeCheck,
    Briefcase,
    Building2,
    CalendarClock,
    Info,
    Languages,
    MapPin,
    Award,
    Video,
    Star,
} from 'lucide-react'

const Appointment = () => {
    const { docId } = useParams<{ docId: string }>()
    const { doctors, token, getDoctorsData } = useContext(AppContext)
    const router = useRouter()

    const [slotIndex, setSlotIndex] = useState(0)
    const [slotTime, setSlotTime] = useState('')
    const [booking, setBooking] = useState(false)

    const docInfo = useMemo(
        () => doctors.find((doc: any) => doc.id === docId) ?? null,
        [doctors, docId],
    )

    // Slots come straight from the consulting hours the doctor set during onboarding, so
    // patients can only pick times the doctor actually works.
    const docSlots: Slot[][] = useMemo(
        () => (docInfo ? generateSlots(docInfo) : []),
        [docInfo],
    )

    // The previously selected time may not exist on the newly selected day.
    useEffect(() => {
        setSlotTime('')
    }, [slotIndex])

    // Land on the first day that actually has slots rather than always on "today", which
    // is empty whenever the doctor does not consult today or the day is already over.
    useEffect(() => {
        if (docSlots.length === 0) return
        const firstOpen = docSlots.findIndex((day) => day.length > 0)
        setSlotIndex(firstOpen === -1 ? 0 : firstOpen)
    }, [docSlots])

    const selectedDaySlots = docSlots[slotIndex] ?? []

    const handleBookAppointment = async () => {
        if (!token) {
            toast.warn('Login to book appointment')
            router.push('/login')
            return
        }
        if (!slotTime) {
            toast.warn('Please pick a time slot')
            return
        }

        // Derived from the selected slot itself. Reading `docSlots[slotIndex][0]` threw a
        // TypeError on any day with no slots left.
        const slot = selectedDaySlots.find((s) => s.time === slotTime)
        if (!slot) {
            toast.error('That slot is no longer available')
            return
        }

        setBooking(true)
        try {
            const res = await bookAppointment(docId, formatSlotDateKey(slot.datetime), slot.time)
            if (res.success) {
                toast.success(res.message)
                // Refresh so the slot we just took disappears for everyone.
                await getDoctorsData()
                router.push('/my-appointments')
            } else {
                toast.error(res.message)
            }
        } finally {
            setBooking(false)
        }
    }

    if (!docInfo) {
        return (
            <div className='min-h-[60vh] flex items-center justify-center font-medium text-gray-500'>
                Loading...
            </div>
        )
    }

    const address = (docInfo.address ?? {}) as { line1?: string; line2?: string }
    const languages: string = docInfo.languages ?? ''
    const modes: string[] = Array.isArray(docInfo.consultationModes) ? docInfo.consultationModes : []
    const availableDays = parseAvailableDays(docInfo.availableDays)
    const clinicLine = [docInfo.hospital, docInfo.city].filter(Boolean).join(', ')

    const facts = [
        { icon: Briefcase, label: 'Experience', value: docInfo.experience },
        { icon: Building2, label: 'Practises at', value: clinicLine },
        { icon: Languages, label: 'Speaks', value: languages },
        { icon: BadgeCheck, label: 'Reg. no.', value: docInfo.registrationNo },
        { icon: Award, label: 'Recognition', value: docInfo.awards },
    ].filter((fact) => Boolean(fact.value))

    return (
        <div>
            {/* ── Doctor details ─────────────────────────────────────────────── */}
            <div className='flex flex-col sm:flex-row gap-4'>
                <div>
                    <img
                        className='bg-blue-50 w-full sm:max-w-72 rounded-lg object-cover'
                        src={avatarFor(docInfo.image, docInfo.gender)}
                        alt={docInfo.name}
                    />
                </div>

                <div className='flex-1 border border-gray-200 rounded-lg p-8 py-7 bg-white mx-2 sm:mx-0 mt-[-80px] sm:mt-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <p className='flex items-center gap-2 text-2xl font-medium text-gray-900'>
                            {docInfo.name}
                            <img className='w-5' src='/assets/verified_icon.svg' alt='Verified' />
                        </p>
                        <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                docInfo.available
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-gray-100 text-gray-500'
                            }`}
                        >
                            {docInfo.available ? 'Accepting bookings' : 'Not accepting bookings'}
                        </span>
                    </div>

                    <div className='flex flex-wrap items-center gap-2 text-sm mt-2 text-gray-600'>
                        <p>
                            {docInfo.degree}
                            {docInfo.degree && docInfo.speciality ? ' - ' : ''}
                            {docInfo.speciality}
                        </p>
                        {docInfo.experience && (
                            <span className='py-0.5 px-2 border border-gray-300 text-xs rounded-full'>
                                {docInfo.experience}
                            </span>
                        )}
                        {typeof docInfo.rating === 'number' && (
                            <span className='flex items-center gap-1 text-xs text-gray-500'>
                                <Star className='w-3.5 h-3.5 text-amber-400 fill-amber-400' />
                                {docInfo.rating.toFixed(1)}
                                {docInfo.totalReviews > 0 && ` (${docInfo.totalReviews} reviews)`}
                            </span>
                        )}
                    </div>

                    {facts.length > 0 && (
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mt-5'>
                            {facts.map((fact) => (
                                <div key={fact.label} className='flex items-start gap-2 text-sm'>
                                    <fact.icon className='w-4 h-4 text-gray-400 shrink-0 mt-0.5' />
                                    <span className='text-gray-500'>
                                        {fact.label}:{' '}
                                        <span className='text-gray-800 font-medium'>{fact.value}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {docInfo.about && (
                        <div className='mt-5'>
                            <p className='flex items-center gap-1.5 text-sm font-medium text-gray-900'>
                                About <Info className='w-3.5 h-3.5 text-gray-400' />
                            </p>
                            <p className='text-sm text-gray-500 max-w-[700px] mt-1 leading-relaxed'>
                                {docInfo.about}
                            </p>
                        </div>
                    )}

                    {(address.line1 || address.line2) && (
                        <p className='flex items-start gap-2 text-sm text-gray-500 mt-4'>
                            <MapPin className='w-4 h-4 text-gray-400 shrink-0 mt-0.5' />
                            <span>
                                {address.line1}
                                {address.line1 && address.line2 ? ', ' : ''}
                                {address.line2}
                            </span>
                        </p>
                    )}

                    <div className='flex flex-wrap items-center gap-2 mt-4'>
                        {modes.map((mode) => (
                            <span
                                key={mode}
                                className='flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full'
                            >
                                <Video className='w-3.5 h-3.5' /> {mode}
                            </span>
                        ))}
                    </div>

                    <p className='flex items-center gap-1.5 text-gray-500 font-medium mt-5'>
                        <CalendarClock className='w-4 h-4 text-gray-400' />
                        Consults on{' '}
                        <span className='text-gray-800'>
                            {[...availableDays]
                                .sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))
                                .join(', ')}
                        </span>
                        <span className='text-gray-400'>
                            · {docInfo.slotStartTime}–{docInfo.slotEndTime}
                        </span>
                    </p>

                    <p className='text-gray-500 font-medium mt-2'>
                        Appointment fee:{' '}
                        <span className='text-gray-900 font-semibold'>{formatINR(docInfo.fees)}</span>
                    </p>
                </div>
            </div>

            {/* ── Booking slots ──────────────────────────────────────────────── */}
            <div className='sm:ml-72 sm:pl-4 mt-6 font-medium text-gray-700'>
                <p>Booking slots</p>

                {!docInfo.available ? (
                    <p className='text-sm text-gray-500 font-normal mt-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3'>
                        This doctor is not accepting new bookings right now.
                    </p>
                ) : (
                    <>
                        <div className='flex gap-3 items-center w-full overflow-x-auto mt-4 pb-1'>
                            {docSlots.map((slots, index) => {
                                const day = new Date()
                                day.setDate(day.getDate() + index)
                                const isOpen = slots.length > 0
                                return (
                                    <button
                                        key={index}
                                        type='button'
                                        disabled={!isOpen}
                                        onClick={() => setSlotIndex(index)}
                                        className={`text-center py-5 min-w-16 rounded-full transition-colors ${
                                            slotIndex === index && isOpen
                                                ? 'bg-primary text-white'
                                                : isOpen
                                                  ? 'border border-gray-200 hover:border-primary cursor-pointer'
                                                  : 'border border-gray-100 text-gray-300 cursor-not-allowed'
                                        }`}
                                    >
                                        <p className='text-xs'>{WEEKDAYS[day.getDay()].toUpperCase()}</p>
                                        <p>{day.getDate()}</p>
                                    </button>
                                )
                            })}
                        </div>

                        {selectedDaySlots.length === 0 ? (
                            <p className='text-sm text-gray-500 font-normal mt-4'>
                                No slots left on this day. Try one of the other{' '}
                                {BOOKING_WINDOW_DAYS - 1} days above.
                            </p>
                        ) : (
                            <div className='flex items-center gap-3 w-full overflow-x-auto mt-4 pb-1'>
                                {selectedDaySlots.map((slot) => (
                                    <button
                                        key={slot.time}
                                        type='button'
                                        onClick={() => setSlotTime(slot.time)}
                                        className={`text-sm font-light flex-shrink-0 px-5 py-2 rounded-full transition-colors ${
                                            slot.time === slotTime
                                                ? 'bg-primary text-white'
                                                : 'text-gray-500 border border-gray-300 hover:border-primary'
                                        }`}
                                    >
                                        {slot.time.toLowerCase()}
                                    </button>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={handleBookAppointment}
                            disabled={booking || !slotTime}
                            className='bg-primary disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-light px-14 py-3 rounded-full mt-6 transition-colors'
                        >
                            {booking ? 'Booking...' : 'Book an appointment'}
                        </button>
                    </>
                )}
            </div>

            <RelatedDoctors docId={docId} speciality={docInfo.speciality} />
        </div>
    )
}

export default Appointment
