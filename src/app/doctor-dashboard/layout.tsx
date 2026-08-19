'use client'

import React, { useCallback, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarClock, UserRound } from 'lucide-react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { AppContext } from '@/context/AppContext'
import { doctorProfile } from '@/app/actions/doctorActions'

const navItems = [
    { href: '/doctor-dashboard/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/doctor-dashboard/appointments', label: 'Appointments', icon: CalendarClock },
    { href: '/doctor-dashboard/profile', label: 'Profile', icon: UserRound },
]

const LOGIN_PATH = '/doctor-dashboard/login'
const ONBOARDING_PATH = '/doctor-dashboard/onboarding'

const DoctorLayout = ({ children }: { children: React.ReactNode }) => {
    const router = useRouter()
    const pathname = usePathname()
    const context = useContext(AppContext)
    const [status, setStatus] = useState<'checking' | 'ready'>('checking')

    const isLoginPage = pathname === LOGIN_PATH
    const isOnboardingPage = pathname === ONBOARDING_PATH

    const check = useCallback(async () => {
        if (isLoginPage) {
            setStatus('ready')
            return
        }

        // Ask the server, not localStorage. A stale localStorage token used to let a
        // doctor into the dashboard with no valid session cookie behind it, so every
        // action answered "Not authorized" and the dashboard just sat there empty.
        const res = await doctorProfile()
        if (!res.success) {
            localStorage.removeItem('docToken')
            router.replace(LOGIN_PATH)
            return
        }

        context?.setDoctorData?.(res.profileData)

        if (!res.profileData.profileCompleted && !isOnboardingPage) {
            router.replace(ONBOARDING_PATH)
            return
        }
        if (res.profileData.profileCompleted && isOnboardingPage) {
            router.replace('/doctor-dashboard/dashboard')
            return
        }

        setStatus('ready')
        // `context` is intentionally not a dependency: the provider rebuilds its value
        // object on every render, which would make this re-run in a loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoginPage, isOnboardingPage, router])

    useEffect(() => {
        setStatus('checking')
        check()
    }, [check])

    const logout = async () => {
        await context?.logoutDoctor?.()
        router.replace(LOGIN_PATH)
    }

    if (isLoginPage) return <>{children}</>
    if (status === 'checking') {
        return (
            <div className='flex items-center justify-center min-h-[60vh]'>
                <div className='flex items-center gap-2 text-primary font-medium'>
                    <span className='w-2 h-2 bg-primary rounded-full animate-bounce'></span>
                    <span className='w-2 h-2 bg-primary rounded-full animate-bounce' style={{ animationDelay: '0.15s' }}></span>
                    <span className='w-2 h-2 bg-primary rounded-full animate-bounce' style={{ animationDelay: '0.3s' }}></span>
                </div>
            </div>
        )
    }

    // Onboarding is shown full-bleed: the doctor has nothing to navigate to yet.
    if (isOnboardingPage) return <>{children}</>

    return (
        <DashboardShell
            brandLabel='MediCare'
            navItems={navItems}
            onLogout={logout}
            avatarUrl={context?.doctorData?.image}
            avatarGender={context?.doctorData?.gender}
            displayName={context?.doctorData ? `Dr. ${context.doctorData.name}` : undefined}
            subLabel={context?.doctorData?.speciality || 'Doctor'}
        >
            {children}
        </DashboardShell>
    )
}

export default DoctorLayout
