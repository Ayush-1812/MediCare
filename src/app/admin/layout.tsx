'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarClock, UserPlus, Users } from 'lucide-react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { logoutAdmin } from '@/app/actions/adminActions'

const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/appointments', label: 'Appointments', icon: CalendarClock },
    { href: '/admin/add-doctor', label: 'Add Doctor', icon: UserPlus },
    { href: '/admin/doctors-list', label: 'Doctors List', icon: Users },
]

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
    const router = useRouter()
    const pathname = usePathname()
    const [checked, setChecked] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem('adminToken')
        if (!token && pathname !== '/admin/login') {
            router.push('/admin/login')
        }
        setChecked(true)
    }, [pathname, router])

    const logout = async () => {
        // Clearing only localStorage left the httpOnly admin cookie in place.
        await logoutAdmin()
        localStorage.removeItem('adminToken')
        router.push('/admin/login')
    }

    if (pathname === '/admin/login') return <>{children}</>
    if (!checked) return null

    return (
        <DashboardShell
            brandLabel='Admin'
            navItems={navItems}
            onLogout={logout}
        >
            {children}
        </DashboardShell>
    )
}

export default AdminLayout
