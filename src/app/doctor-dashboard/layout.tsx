'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const DoctorLayout = ({ children }: { children: React.ReactNode }) => {
    const router = useRouter()
    const pathname = usePathname()
    const [docToken, setDocToken] = useState<string | null>(null)

    useEffect(() => {
        const token = localStorage.getItem('docToken')
        if (!token && pathname !== '/doctor-dashboard/login') {
            router.push('/doctor-dashboard/login')
        }
        setDocToken(token)
    }, [pathname, router])

    const logout = () => {
        localStorage.removeItem('docToken')
        setDocToken(null)
        router.push('/doctor-dashboard/login')
    }

    if (pathname === '/doctor-dashboard/login') return <>{children}</>

    return (
        <div className='flex items-start bg-[#F8F9FD] min-h-screen'>
            {/* Sidebar */}
            <div className='min-h-screen bg-white border-r'>
                <ul className='text-[#515151] mt-5'>
                    <Link href='/doctor-dashboard/dashboard'>
                        <li className={`flex items-center gap-3 py-3.5 px-3 md:px-9 md:min-w-64 cursor-pointer ${pathname === '/doctor-dashboard/dashboard' ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`}>
                            <img className='w-5' src="/assets/home_icon.svg" alt="" />
                            <p className='hidden md:block'>Dashboard</p>
                        </li>
                    </Link>
                    <Link href='/doctor-dashboard/appointments'>
                        <li className={`flex items-center gap-3 py-3.5 px-3 md:px-9 md:min-w-64 cursor-pointer ${pathname === '/doctor-dashboard/appointments' ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`}>
                            <img className='w-5' src="/assets/appointment_icon.svg" alt="" />
                            <p className='hidden md:block'>Appointments</p>
                        </li>
                    </Link>
                    <Link href='/doctor-dashboard/profile'>
                        <li className={`flex items-center gap-3 py-3.5 px-3 md:px-9 md:min-w-64 cursor-pointer ${pathname === '/doctor-dashboard/profile' ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`}>
                            <img className='w-5' src="/assets/people_icon.svg" alt="" />
                            <p className='hidden md:block'>Profile</p>
                        </li>
                    </Link>
                </ul>
                <button onClick={logout} className='mt-10 mx-5 bg-primary text-white px-10 py-2 rounded-full text-sm hidden md:block'>Logout</button>
            </div>

            {/* Main Content */}
            <div className='flex-1 m-5 sm:m-7'>
                {children}
            </div>
        </div>
    )
}

export default DoctorLayout
