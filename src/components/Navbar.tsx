'use client'

import React, { useContext, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { AppContext } from '../context/AppContext'

const Navbar = () => {
    const router = useRouter()
    const pathname = usePathname()
    const context = useContext(AppContext)
    const token = context?.token
    const setToken = context?.setToken
    const userData = context?.userData
    const [showMenu, setShowMenu] = useState(false)

    const logout = () => {
        setToken(false)
        localStorage.removeItem('token')
        router.push('/login')
    }

    return (
        <div className='flex items-center justify-between text-sm py-4 mb-5 border-b border-b-gray-400'>
            <Link href="/">
                <img className='w-44 cursor-pointer' src="/assets/logo.svg" alt='Logo' />
            </Link>

            <ul className='hidden md:flex items-start gap-5 font-medium'>
                <Link href="/">
                    <li className={`py-1 ${pathname === '/' ? 'text-primary' : ''}`}>HOME</li>
                </Link>
                <Link href="/doctors">
                    <li className={`py-1 ${pathname.startsWith('/doctors') ? 'text-primary' : ''}`}>ALL DOCTORS</li>
                </Link>
                <Link href="/pharmacies">
                    <li className={`py-1 ${pathname === '/pharmacies' ? 'text-primary' : ''}`}>NEARBY PHARMACIES</li>
                </Link>
                <Link href="/about">
                    <li className={`py-1 ${pathname === '/about' ? 'text-primary' : ''}`}>ABOUT</li>
                </Link>
                <Link href="/contact">
                    <li className={`py-1 ${pathname === '/contact' ? 'text-primary' : ''}`}>CONTACT</li>
                </Link>

            </ul>

            <div className='flex items-center gap-4'>
                {token ? (
                    <div className='flex items-center gap-2 cursor-pointer group relative'>
                        <img className='w-8 rounded-full' src={userData?.image || "/assets/profile_pic.png"} alt="" />
                        <img className='w-2.5' src="/assets/dropdown_icon.svg" alt="" />
                        <div className='absolute top-0 right-0 pt-14 text-base font-medium text-gray-600 z-20 hidden group-hover:block'>
                            <div className='min-w-48 bg-stone-100 rounded flex flex-col gap-4 p-4'>
                                <p onClick={() => router.push('/my-profile')} className='hover:text-black cursor-pointer'>My Profile</p>
                                <p onClick={() => router.push('/my-appointments')} className='hover:text-black cursor-pointer'>My Appointments</p>
                                <p onClick={logout} className='hover:text-black cursor-pointer'>Logout</p>
                            </div>
                        </div>
                    </div>
                ) : context?.docToken ? (
                    <div className='flex items-center gap-2 cursor-pointer group relative'>
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-primary font-bold">D</div>
                        <img className='w-2.5' src="/assets/dropdown_icon.svg" alt="" />
                        <div className='absolute top-0 right-0 pt-14 text-base font-medium text-gray-600 z-20 hidden group-hover:block'>
                            <div className='min-w-48 bg-stone-100 rounded flex flex-col gap-4 p-4'>
                                <p onClick={() => router.push('/doctor-dashboard')} className='hover:text-black cursor-pointer'>Doctor Dashboard</p>
                                <p onClick={() => {
                                    context.setDocToken(false)
                                    localStorage.removeItem('docToken')
                                    router.push('/login')
                                }} className='hover:text-black cursor-pointer'>Logout</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => router.push('/login')} className='bg-primary text-white px-8 py-3 rounded-full font-light hidden md:block'>
                        Create Account
                    </button>
                )}
                <img onClick={() => setShowMenu(true)} className='w-6 md:hidden' src="/assets/menu_icon.svg" alt="" />
            </div>

            {/* Mobile Menu */}
            <div className={`${showMenu ? 'fixed w-full' : 'h-0 w-0'} md:hidden right-0 top-0 bottom-0 z-20 overflow-hidden bg-white transition-all`}>
                <div className='flex items-center justify-between px-5 py-6'>
                    <img className='w-36' src="/assets/logo.svg" alt="" />
                    <img className='w-7' onClick={() => setShowMenu(false)} src="/assets/cross_icon.png" alt="" />
                </div>
                <ul className='flex flex-col items-center gap-2 mt-5 px-5 text-lg font-medium'>
                    <Link href="/" onClick={() => setShowMenu(false)}><p className="px-4 py-2 rounded inline-block">HOME</p></Link>
                    <Link href="/doctors" onClick={() => setShowMenu(false)}><p className="px-4 py-2 rounded inline-block">ALL DOCTORS</p></Link>
                    <Link href="/about" onClick={() => setShowMenu(false)}><p className="px-4 py-2 rounded inline-block">ABOUT</p></Link>
                    <Link href="/contact" onClick={() => setShowMenu(false)}><p className="px-4 py-2 rounded inline-block">CONTACT</p></Link>
                </ul>
            </div>
        </div>
    )
}

export default Navbar
