'use client'

import React, { useContext } from 'react'
import { useRouter } from 'next/navigation'
import { AppContext } from '../../context/AppContext'
import { ArrowUpRight } from 'lucide-react'

const CTASection = () => {
    const router = useRouter()
    const context = useContext(AppContext)

    const isPatient = Boolean(context?.token)
    const isDoctor = Boolean(context?.docToken)

    // Same rule as the hero: someone already signed in is past "Get Started", so show
    // them the action that is actually next for them.
    const action = isPatient
        ? { label: 'Find a Doctor', href: '/doctors', heading: 'Ready for your next consultation?' }
        : isDoctor
          ? { label: 'Go to Dashboard', href: '/doctor-dashboard/dashboard', heading: 'Manage your practice' }
          : { label: 'Get Started', href: '/login?mode=signup', heading: 'Take Control of Your Health with AI' }

    return (
        <div className='py-16 md:mx-10 px-6 sm:px-10 lg:px-20 mb-20'>
            <div className='bg-gray-50 rounded-3xl p-12 text-center flex flex-col items-center border border-gray-100 shadow-sm'>
                <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-8'>{action.heading}</h2>
                <button
                    onClick={() => { window.scrollTo(0, 0); router.push(action.href) }}
                    className='flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-full text-base font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105'
                >
                    {action.label} <ArrowUpRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    )
}

export default CTASection
