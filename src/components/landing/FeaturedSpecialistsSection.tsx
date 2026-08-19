'use client'

import React, { useContext } from 'react'
import { useRouter } from 'next/navigation'
import { AppContext } from '../../context/AppContext'
import { Bot, User as UserIcon, Star } from 'lucide-react'
import { avatarFor } from '@/lib/avatar'
import { formatINR } from '@/lib/currency'

const FeaturedSpecialistsSection = () => {
    const router = useRouter()
    const { doctors } = useContext(AppContext)

    return (
        <div className='py-20 md:mx-10 px-6 sm:px-10 lg:px-20 text-center flex flex-col items-center'>
            <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-12'>Featured Specialists</h2>
            
            {/* AI Chat Mockup above doctors */}
            <div className='w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-12 text-left'>
                <div className='flex gap-3 mb-4'>
                    <div className='w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0'>
                        <UserIcon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className='bg-gray-100 text-gray-800 text-sm p-3 rounded-2xl rounded-tl-sm'>
                        Hi, I need an appointment for a general checkup. Who do you recommend?
                    </div>
                </div>
                <div className='flex gap-3 flex-row-reverse'>
                    <div className='w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0'>
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className='bg-blue-600 text-white text-sm p-3 rounded-2xl rounded-tr-sm'>
                        I recommend Dr. Richard James or Dr. Chloe Evans for general checkups. You can view their profiles below.
                    </div>
                </div>
            </div>

            {/* Doctors Grid */}
            <div className='w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
                {doctors && doctors.slice(0, 4).map((item: any, index: number) => (
                    <div onClick={() => router.push(`/appointment/${item.id}`)} className='border border-gray-200 rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 bg-white flex flex-col items-center p-4' key={index}>
                        <div className='w-24 h-24 rounded-full overflow-hidden bg-blue-50 mb-4 border-4 border-white shadow-sm'>
                            <img
                                className="w-full h-full object-cover"
                                src={avatarFor(item.image, item.gender)}
                                alt={item.name || "Doctor"}
                            />
                        </div>

                        <div className='text-center'>
                            <p className='text-gray-900 text-lg font-bold mb-1'>{item.name}</p>
                            <p className='text-blue-600 text-sm font-medium mb-3'>{item.speciality}</p>
                            
                            {/* Was a hard-coded "4.8 (120+ Reviews)" on every card. Only shown
                                when the doctor actually has a rating. */}
                            <div className='flex items-center justify-center gap-1 text-xs text-gray-500 mb-4 bg-gray-50 py-1 px-3 rounded-full'>
                                {typeof item.rating === 'number' ? (
                                    <>
                                        <Star className='w-3 h-3 text-amber-400 fill-amber-400' />
                                        {item.rating.toFixed(1)}
                                        {item.totalReviews > 0 && ` (${item.totalReviews} reviews)`}
                                    </>
                                ) : (
                                    <>{formatINR(item.fees)} / consultation</>
                                )}
                            </div>
                            
                            <button className='w-full bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 font-semibold py-2 rounded-full text-sm transition-colors duration-300'>
                                Book Appointment
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button onClick={() => router.push('/doctors')} className='bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold px-8 py-3 rounded-full mt-12 transition-colors'>
                View All Doctors
            </button>
        </div>
    )
}

export default FeaturedSpecialistsSection
