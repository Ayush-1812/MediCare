'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, MapPin, Star } from 'lucide-react'
import { avatarFor } from '@/lib/avatar'
import { formatINR } from '@/lib/currency'

/**
 * The card used everywhere patients browse doctors (home, All Doctors, Related Doctors).
 * It carries the details someone actually needs to pick a doctor — speciality,
 * qualification, experience, where they practise and what they charge — rather than just
 * a name and a photo.
 */
const DoctorCard = ({ doctor, scrollToTop = false }: { doctor: any; scrollToTop?: boolean }) => {
    const router = useRouter()

    const address = (doctor.address ?? {}) as { line1?: string; line2?: string }
    const location = [doctor.hospital, doctor.city].filter(Boolean).join(', ') || address.line1 || ''

    const open = () => {
        router.push(`/appointment/${doctor.id}`)
        if (scrollToTop) window.scrollTo(0, 0)
    }

    return (
        <div
            onClick={open}
            role='button'
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    open()
                }
            }}
            className='border border-blue-200 rounded-xl overflow-hidden cursor-pointer bg-white hover:-translate-y-2 hover:shadow-lg transition-all duration-300 flex flex-col focus:outline-none focus:ring-2 focus:ring-primary/40'
        >
            <img
                className='bg-blue-50 w-full h-48 object-cover'
                // Falls back to a male/female avatar until the doctor uploads a photo.
                src={avatarFor(doctor.image, doctor.gender)}
                alt={doctor.name || 'Doctor'}
            />

            <div className='p-4 flex flex-col gap-1 flex-1'>
                <div
                    className={`flex items-center gap-2 text-sm ${
                        doctor.available ? 'text-green-500' : 'text-gray-400'
                    }`}
                >
                    <span
                        className={`w-2 h-2 rounded-full ${
                            doctor.available ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                    />
                    {/* This used to read "Available" for everyone, whatever the doctor had set. */}
                    <p>{doctor.available ? 'Available' : 'Unavailable'}</p>
                </div>

                <p className='text-gray-900 text-lg font-medium leading-snug'>{doctor.name}</p>
                <p className='text-primary text-sm font-medium'>{doctor.speciality}</p>

                {doctor.degree && <p className='text-gray-500 text-xs'>{doctor.degree}</p>}

                <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1'>
                    {doctor.experience && (
                        <span className='flex items-center gap-1'>
                            <Briefcase className='w-3.5 h-3.5 text-gray-400' />
                            {doctor.experience}
                        </span>
                    )}
                    {typeof doctor.rating === 'number' && (
                        <span className='flex items-center gap-1'>
                            <Star className='w-3.5 h-3.5 text-amber-400 fill-amber-400' />
                            {doctor.rating.toFixed(1)}
                        </span>
                    )}
                </div>

                {location && (
                    <p className='flex items-start gap-1 text-xs text-gray-500 mt-0.5'>
                        <MapPin className='w-3.5 h-3.5 text-gray-400 shrink-0 mt-px' />
                        <span className='line-clamp-1'>{location}</span>
                    </p>
                )}

                <p className='text-sm font-semibold text-gray-900 mt-auto pt-2'>
                    {formatINR(doctor.fees)}
                    <span className='text-xs font-normal text-gray-400'> / consultation</span>
                </p>
            </div>
        </div>
    )
}

export default DoctorCard
