'use client'

import React, { useContext } from 'react'
import { useRouter } from 'next/navigation'
import { AppContext } from '../../context/AppContext'
import { ArrowUpRight, Shield, Calendar, Activity, CheckCircle2, MessageSquare, Bot } from 'lucide-react'

const HeroSection = () => {
    const router = useRouter()
    const context = useContext(AppContext)

    const isPatient = Boolean(context?.token)
    const isDoctor = Boolean(context?.docToken)
    const isLoggedIn = isPatient || isDoctor

    // "Get Started" only means something to a visitor who has no account yet. Someone
    // already signed in gets the action that is actually next for them.
    const primaryAction = isPatient
        ? { label: 'Find a Doctor', href: '/doctors' }
        : isDoctor
          ? { label: 'Go to Dashboard', href: '/doctor-dashboard/dashboard' }
          : { label: 'Get Started', href: '/login?mode=signup' }

    const handlePrimaryAction = () => {
        window.scrollTo(0, 0)
        router.push(primaryAction.href)
    }

    return (
        <div className='relative w-full rounded-3xl overflow-hidden min-h-[600px] flex items-center md:mx-10 my-10 bg-blue-50'>
            {/* Background Image / Pattern */}
            <div 
                className='absolute inset-0 z-0 opacity-30 bg-cover bg-center'
                style={{ backgroundImage: "url('/assets/header_img.png')" }}
            ></div>
            
            {/* Gradient Overlay for better readability */}
            <div className='absolute inset-0 bg-gradient-to-r from-blue-100/90 via-blue-50/70 to-transparent z-0'></div>

            <div className='relative z-10 flex flex-col lg:flex-row w-full h-full p-6 sm:p-10 md:p-14 lg:p-20 items-center justify-between gap-10'>
                
                {/* Left Side: Text and Buttons */}
                <div className='w-full lg:w-1/2 flex flex-col items-start'>
                    <div className='bg-white/40 backdrop-blur-xl border border-white/50 p-8 md:p-12 rounded-3xl shadow-lg w-full max-w-xl'>
                        <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6'>
                            {isLoggedIn ? (
                                <>Welcome back to <br className='hidden md:block' /> your health <br className='hidden md:block' /> companion</>
                            ) : (
                                <>Your Personal AI <br className='hidden md:block' /> Healthcare <br className='hidden md:block' /> Companion</>
                            )}
                        </h1>
                        <p className='text-gray-700 text-lg md:text-xl mb-8 leading-relaxed font-medium'>
                            {isLoggedIn
                                ? 'Book a consultation, review your prescriptions, or ask Aether AI about your health records.'
                                : 'Leverage the power of advanced AI for personalized health insights, smart doctor booking, and seamless appointment management.'}
                        </p>
                        
                        <div className='flex flex-col sm:flex-row items-center gap-4 w-full'>
                            <button
                                onClick={handlePrimaryAction}
                                className='w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-full text-base font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105'
                            >
                                {primaryAction.label} <ArrowUpRight className="w-5 h-5" />
                            </button>
                            <a
                                href={isPatient ? '/ai-assistant' : '#features'}
                                className='w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 px-8 py-3.5 rounded-full text-base font-semibold transition-all duration-300 hover:shadow-md'
                            >
                                {isPatient ? 'Ask Aether AI' : 'Explore Features'}
                            </a>
                        </div>
                    </div>
                </div>

                {/* Right Side: AI Dashboard Mockup */}
                <div className='w-full lg:w-1/2 flex justify-center lg:justify-end relative hidden md:flex'>
                    <div className='relative w-full max-w-[500px] h-[380px] bg-white/60 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-2xl p-6 transform hover:-translate-y-2 transition-transform duration-700'>
                        
                        {/* Mockup Header */}
                        <div className='flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4'>
                            <div className='flex items-center gap-3'>
                                <div className='w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md'>
                                    <Activity className='text-white w-6 h-6' />
                                </div>
                                <div>
                                    <h3 className='font-bold text-gray-800'>AI Dashboard</h3>
                                </div>
                            </div>
                            <div className='flex gap-2'>
                                <div className='w-3 h-3 rounded-full bg-red-400'></div>
                                <div className='w-3 h-3 rounded-full bg-yellow-400'></div>
                                <div className='w-3 h-3 rounded-full bg-green-400'></div>
                            </div>
                        </div>

                        <div className='flex gap-4 h-[250px]'>
                            {/* Mockup Sidebar */}
                            <div className='w-16 flex flex-col gap-4 items-center pt-2'>
                                <div className='w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm'><CheckCircle2 className="w-5 h-5"/></div>
                                <div className='w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm hover:bg-gray-200 cursor-pointer transition-colors'><Calendar className="w-5 h-5"/></div>
                                <div className='w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm hover:bg-gray-200 cursor-pointer transition-colors'><Shield className="w-5 h-5"/></div>
                            </div>

                            {/* Mockup Main Content */}
                            <div className='flex-1 flex flex-col gap-4'>
                                {/* Health Score Card */}
                                <div className='bg-white/80 rounded-2xl p-4 shadow-sm flex items-center gap-6 border border-white'>
                                    <div className='relative'>
                                        <svg className='w-16 h-16 transform -rotate-90'>
                                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-200" />
                                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="175" strokeDashoffset="25" className="text-green-500" />
                                        </svg>
                                        <div className='absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center'>
                                            <span className='text-xl font-bold text-gray-800'>92</span>
                                        </div>
                                    </div>
                                    <div className='flex-1'>
                                        <p className='text-sm text-gray-500 font-medium mb-1'>Health Score</p>
                                        <div className='flex justify-between items-center text-sm'>
                                            <span className='text-gray-700 font-medium'>Excellent</span>
                                            <span className='text-green-600 font-bold'>+3</span>
                                        </div>
                                        <div className='w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden'>
                                            <div className='bg-green-500 h-1.5 rounded-full' style={{width: '92%'}}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Appointment Card */}
                                <div className='bg-white/80 rounded-2xl p-4 shadow-sm border border-white flex gap-4 items-center'>
                                    <img src="/assets/doc1.png" className='w-12 h-12 rounded-full object-cover bg-blue-50' alt="Doctor" />
                                    <div>
                                        <p className='text-xs text-blue-600 font-bold tracking-wider mb-1 uppercase'>Upcoming Appointment</p>
                                        <p className='text-sm font-bold text-gray-800'>Dr. Richard James</p>
                                        <p className='text-xs text-gray-500'>General Physician • Tomorrow, 10:00 AM</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating AI Assistant Chat */}
                        <div className='absolute -bottom-6 -right-6 w-[280px] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden hidden lg:block'>
                            <div className='bg-blue-600 text-white p-3 flex items-center gap-2'>
                                <Bot className='w-5 h-5' />
                                <span className='font-bold text-sm'>AI Assistant</span>
                            </div>
                            <div className='p-4 bg-gray-50'>
                                <div className='bg-blue-600 text-white text-xs p-3 rounded-2xl rounded-tr-sm inline-block shadow-sm float-right mb-2'>
                                    I have a headache and fever.
                                </div>
                                <div className='clear-both'></div>
                                <div className='bg-white text-gray-700 border border-gray-100 text-xs p-3 rounded-2xl rounded-tl-sm shadow-sm inline-block max-w-[90%]'>
                                    I recommend booking a General Physician. Dr. Richard James is available tomorrow.
                                </div>
                            </div>
                            <div className='p-3 bg-white border-t border-gray-100 flex items-center gap-2'>
                                <div className='flex-1 text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-2'>Type a message...</div>
                                <div className='w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer'>
                                    <MessageSquare className='w-3 h-3 text-white' />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    )
}

export default HeroSection
