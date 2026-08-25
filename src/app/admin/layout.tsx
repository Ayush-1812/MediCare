'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarClock, UserPlus, Users } from 'lucide-react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { logoutAdmin, verifyAdminSession } from '@/app/actions/adminActions'

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

    // Ask the server, not localStorage. A value in localStorage is writable from the
    // browser console and says nothing about the httpOnly cookie the server actually
    // trusts — so the old check let anyone render the admin shell, and left a doctor or
    // patient with a stale entry seeing it too.
    useEffect(() => {
        if (pathname === '/admin/login') {
            setChecked(true)
            return
        }

        let cancelled = false
        verifyAdminSession().then((res) => {
            if (cancelled) return
            if (!res.success) {
                localStorage.removeItem('adminToken')
                router.replace('/admin/login')
                return
            }
            setChecked(true)
        })

        return () => {
            cancelled = true
        }
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
