'use client'

import React, { useContext, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { AppContext } from '../context/AppContext'
import { Sparkles, ChevronDown, LayoutDashboard, CalendarDays, LogOut, X, Menu } from 'lucide-react'
import { avatarFor } from '@/lib/avatar'

const Navbar = () => {
    const router = useRouter()
    const pathname = usePathname()
    const context = useContext(AppContext)
    const token = context?.token
    const docToken = context?.docToken
    const userData = context?.userData
    const doctorData = context?.doctorData
    const [showMenu, setShowMenu] = useState(false)

    const isLoggedIn = Boolean(token || docToken)

    const logout = async () => {
        setShowMenu(false)
        await context?.logoutUser?.()
        router.push('/login')
    }

    const doctorLogout = async () => {
        setShowMenu(false)
        await context?.logoutDoctor?.()
        router.push('/login')
    }

    const navLinks = [
        { href: '/', label: 'HOME', match: (p: string) => p === '/' },
        { href: '/about', label: 'ABOUT', match: (p: string) => p === '/about' },
        { href: '/contact', label: 'CONTACT', match: (p: string) => p === '/contact' },
    ]

    return (
        // Note: backdrop-blur lives on the inner bar, not this wrapper — a `backdrop-filter`
        // ancestor becomes the containing block for `position: fixed` children, which would
        // shrink the mobile drawer/backdrop below to the navbar's own height instead of the viewport.
        <div className='sticky top-0 z-40 -mx-4 sm:-mx-[10%]'>
            <div className='px-4 sm:px-[10%] bg-white/80 backdrop-blur-xl border-b border-gray-100/80'>
            <div className='flex items-center justify-between text-sm py-4 md:mx-10 px-6 sm:px-10 lg:px-20'>
                <Link href="/" className='shrink-0'>
                    <img className='w-52 sm:w-60 cursor-pointer' src="/assets/logo.svg" alt='MediCare' />
                </Link>

                <ul className='hidden md:flex items-center gap-6 font-medium text-gray-600'>
                    <Link href="/">
                        <li className={`py-1 transition-colors ${pathname === '/' ? 'text-primary font-semibold' : 'hover:text-gray-900'}`}>HOME</li>
                    </Link>
                    {isLoggedIn && (
                        <>
                            <Link href="/doctors">
                                <li className={`py-1 transition-colors ${pathname.startsWith('/doctors') ? 'text-primary font-semibold' : 'hover:text-gray-900'}`}>ALL DOCTORS</li>
                            </Link>
                            <Link href="/pharmacies">
                                <li className={`py-1 transition-colors ${pathname === '/pharmacies' ? 'text-primary font-semibold' : 'hover:text-gray-900'}`}>NEARBY PHARMACIES</li>
                            </Link>
                            <Link href="/ai-assistant">
                                <li className={`py-1 flex items-center gap-1.5 transition-colors ${pathname === '/ai-assistant' ? 'text-primary font-semibold' : 'hover:text-primary/80'}`}>
                                    <Sparkles className="w-4 h-4" /> AI ASSISTANT
                                </li>
                            </Link>
                        </>
                    )}
                    <Link href="/about">
                        <li className={`py-1 transition-colors ${pathname === '/about' ? 'text-primary font-semibold' : 'hover:text-gray-900'}`}>ABOUT</li>
                    </Link>
                    <Link href="/contact">
                        <li className={`py-1 transition-colors ${pathname === '/contact' ? 'text-primary font-semibold' : 'hover:text-gray-900'}`}>CONTACT</li>
                    </Link>
                </ul>

                <div className='flex items-center gap-3'>
                    {token ? (
                        <div className='hidden md:flex items-center gap-2 cursor-pointer group relative py-2'>
                            <img className='w-9 h-9 rounded-full object-cover ring-2 ring-blue-50 group-hover:ring-primary/30 transition-all' src={avatarFor(userData?.image, userData?.gender)} alt="" />
                            <ChevronDown className='w-4 h-4 text-gray-400 group-hover:rotate-180 transition-transform duration-300' />
                            <div className='absolute top-full right-0 pt-3 text-sm font-medium text-gray-600 z-20 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200'>
                                <div className='min-w-56 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100 flex flex-col p-2 overflow-hidden'>
                                    <div className='px-3 py-2.5 mb-1 border-b border-gray-100'>
                                        <p className='text-gray-900 font-semibold truncate'>{userData?.name || 'Patient'}</p>
                                        <p className='text-xs text-gray-400 truncate'>{userData?.email}</p>
                                    </div>
                                    <button onClick={() => router.push('/my-profile')} className='flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-blue-50 hover:text-primary text-left transition-colors'>
                                        <LayoutDashboard className='w-4 h-4' /> My Profile
                                    </button>
                                    <button onClick={() => router.push('/my-appointments')} className='flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-blue-50 hover:text-primary text-left transition-colors'>
                                        <CalendarDays className='w-4 h-4' /> My Appointments
                                    </button>
                                    <button onClick={logout} className='flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-50 hover:text-red-600 text-left transition-colors'>
                                        <LogOut className='w-4 h-4' /> Logout
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : docToken ? (
                        <div className='hidden md:flex items-center gap-2 cursor-pointer group relative py-2'>
                            <img className='w-9 h-9 rounded-full object-cover ring-2 ring-blue-50 group-hover:ring-primary/30 transition-all bg-blue-100' src={avatarFor(doctorData?.image, doctorData?.gender)} alt="" />
                            <ChevronDown className='w-4 h-4 text-gray-400 group-hover:rotate-180 transition-transform duration-300' />
                            <div className='absolute top-full right-0 pt-3 text-sm font-medium text-gray-600 z-20 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200'>
                                <div className='min-w-56 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100 flex flex-col p-2 overflow-hidden'>
                                    <div className='px-3 py-2.5 mb-1 border-b border-gray-100'>
                                        <p className='text-gray-900 font-semibold truncate'>Dr. {doctorData?.name || ''}</p>
                                        <p className='text-xs text-gray-400 truncate'>{doctorData?.speciality || 'Doctor'}</p>
                                    </div>
                                    <button onClick={() => router.push('/doctor-dashboard/dashboard')} className='flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-blue-50 hover:text-primary text-left transition-colors'>
                                        <LayoutDashboard className='w-4 h-4' /> Dashboard
                                    </button>
                                    <button onClick={() => router.push('/doctor-dashboard/profile')} className='flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-blue-50 hover:text-primary text-left transition-colors'>
                                        <CalendarDays className='w-4 h-4' /> My Profile
                                    </button>
                                    <button onClick={doctorLogout} className='flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-50 hover:text-red-600 text-left transition-colors'>
                                        <LogOut className='w-4 h-4' /> Logout
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className='hidden md:flex items-center gap-3'>
                            <Link href='/login?mode=login' className='text-gray-600 font-medium px-4 py-2.5 rounded-full hover:bg-gray-100 hover:text-gray-900 transition-all'>
                                Login
                            </Link>
                            <Link href='/login?mode=signup' className='bg-primary text-white px-6 py-2.5 rounded-full font-medium shadow-sm hover:shadow-md hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0 transition-all'>
                                Create Account
                            </Link>
                        </div>
                    )}
                    <button onClick={() => setShowMenu(true)} className='md:hidden p-1.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors' aria-label="Open menu">
                        <Menu className='w-6 h-6' />
                    </button>
                </div>
            </div>
            </div>

            {/* Mobile Menu Backdrop */}
            {showMenu && (
                <div
                    className='fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden animate-fade-in'
                    onClick={() => setShowMenu(false)}
                />
            )}

            {/* Mobile Menu Drawer */}
            <div className={`fixed md:hidden right-0 top-0 bottom-0 z-50 w-[82%] max-w-xs bg-white shadow-2xl transition-transform duration-300 ease-out ${showMenu ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className='flex items-center justify-between px-5 py-5 border-b border-gray-100'>
                    <img className='w-40' src="/assets/logo.svg" alt="MediCare" />
                    <button onClick={() => setShowMenu(false)} className='p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors' aria-label="Close menu">
                        <X className='w-6 h-6' />
                    </button>
                </div>

                {isLoggedIn && (
                    <div className='flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-blue-50/50'>
                        <img
                            className='w-11 h-11 rounded-full object-cover bg-blue-100'
                            src={token
                                ? avatarFor(userData?.image, userData?.gender)
                                : avatarFor(doctorData?.image, doctorData?.gender)}
                            alt=""
                        />
                        <div className='min-w-0'>
                            <p className='font-semibold text-gray-900 truncate'>{token ? (userData?.name || 'Patient') : `Dr. ${doctorData?.name || ''}`}</p>
                            <p className='text-xs text-gray-500 truncate'>{token ? userData?.email : (doctorData?.speciality || 'Doctor')}</p>
                        </div>
                    </div>
                )}

                <ul className='flex flex-col gap-1 mt-3 px-3 text-base font-medium text-gray-700'>
                    <Link href="/" onClick={() => setShowMenu(false)}>
                        <p className={`px-4 py-3 rounded-xl transition-colors ${pathname === '/' ? 'bg-blue-50 text-primary' : 'hover:bg-gray-50'}`}>Home</p>
                    </Link>
                    {isLoggedIn && (
                        <>
                            <Link href="/doctors" onClick={() => setShowMenu(false)}>
                                <p className={`px-4 py-3 rounded-xl transition-colors ${pathname.startsWith('/doctors') ? 'bg-blue-50 text-primary' : 'hover:bg-gray-50'}`}>All Doctors</p>
                            </Link>
                            <Link href="/pharmacies" onClick={() => setShowMenu(false)}>
                                <p className={`px-4 py-3 rounded-xl transition-colors ${pathname === '/pharmacies' ? 'bg-blue-50 text-primary' : 'hover:bg-gray-50'}`}>Nearby Pharmacies</p>
                            </Link>
                            <Link href="/ai-assistant" onClick={() => setShowMenu(false)}>
                                <p className='px-4 py-3 rounded-xl inline-flex items-center gap-2 text-primary font-semibold w-full hover:bg-blue-50 transition-colors'>
                                    <Sparkles className="w-4 h-4" /> AI Assistant
                                </p>
                            </Link>
                        </>
                    )}
                    {token && (
                        <>
                            <Link href="/my-profile" onClick={() => setShowMenu(false)}>
                                <p className='px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors'>My Profile</p>
                            </Link>
                            <Link href="/my-appointments" onClick={() => setShowMenu(false)}>
                                <p className='px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors'>My Appointments</p>
                            </Link>
                        </>
                    )}
                    {docToken && (
                        <>
                            <Link href="/doctor-dashboard/dashboard" onClick={() => setShowMenu(false)}>
                                <p className='px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors'>Dashboard</p>
                            </Link>
                            <Link href="/doctor-dashboard/appointments" onClick={() => setShowMenu(false)}>
                                <p className='px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors'>Appointments</p>
                            </Link>
                            <Link href="/doctor-dashboard/profile" onClick={() => setShowMenu(false)}>
                                <p className='px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors'>My Profile</p>
                            </Link>
                        </>
                    )}
                    <Link href="/about" onClick={() => setShowMenu(false)}>
                        <p className={`px-4 py-3 rounded-xl transition-colors ${pathname === '/about' ? 'bg-blue-50 text-primary' : 'hover:bg-gray-50'}`}>About</p>
                    </Link>
                    <Link href="/contact" onClick={() => setShowMenu(false)}>
                        <p className={`px-4 py-3 rounded-xl transition-colors ${pathname === '/contact' ? 'bg-blue-50 text-primary' : 'hover:bg-gray-50'}`}>Contact</p>
                    </Link>
                </ul>

                <div className='absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100'>
                    {isLoggedIn ? (
                        <button
                            onClick={token ? logout : doctorLogout}
                            className='w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-semibold py-3 rounded-xl hover:bg-red-100 transition-colors'
                        >
                            <LogOut className='w-4 h-4' /> Logout
                        </button>
                    ) : (
                        <div className='flex flex-col gap-2'>
                            <Link href='/login?mode=signup' onClick={() => setShowMenu(false)} className='w-full text-center bg-primary text-white font-semibold py-3 rounded-xl hover:bg-primary/90 transition-colors'>
                                Create Account
                            </Link>
                            <Link href='/login?mode=login' onClick={() => setShowMenu(false)} className='w-full text-center text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors'>
                                Login
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Navbar
