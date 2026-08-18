'use client'

import React, { useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarClock, UserRound } from 'lucide-react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { AppContext } from '@/context/AppContext'

const navItems = [
    { href: '/doctor-dashboard/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/doctor-dashboard/appointments', label: 'Appointments', icon: CalendarClock },
    { href: '/doctor-dashboard/profile', label: 'Profile', icon: UserRound },
]

const DoctorLayout = ({ children }: { children: React.ReactNode }) => {
    const router = useRouter()
    const pathname = usePathname()
    const context = useContext(AppContext)
    const [checked, setChecked] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem('docToken')
        if (!token && pathname !== '/doctor-dashboard/login') {
            router.push('/doctor-dashboard/login')
        }
        setChecked(true)
    }, [pathname, router])

    const logout = () => {
        context?.logoutDoctor?.()
        router.push('/doctor-dashboard/login')
    }

    if (pathname === '/doctor-dashboard/login') return <>{children}</>
    if (!checked) return null

    return (
        <DashboardShell
            brandLabel='MediCare'
            navItems={navItems}
            onLogout={logout}
            avatarUrl={context?.doctorData?.image}
            displayName={context?.doctorData ? `Dr. ${context.doctorData.name}` : undefined}
            subLabel={context?.doctorData?.speciality || 'Doctor'}
        >
            {children}
        </DashboardShell>
    )
}

export default DoctorLayout
