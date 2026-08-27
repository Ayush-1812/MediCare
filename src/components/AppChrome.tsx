'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

/**
 * Site chrome — navbar, footer and the centred content gutter — for pages that want it.
 *
 * Some pages are full-viewport surfaces and are actively harmed by it. The auth pages are
 * designed as a split screen (hero panel one side, form the other), but the root layout's
 * `mx-4 sm:mx-[10%]` gutter squeezed them into the middle 80% and the navbar stacked a
 * second "Login / Create Account" pair directly above the login form. The consultation
 * room has the same problem: it needs the whole window.
 */
const IMMERSIVE_ROUTES = [
    /^\/login(\/|$)/,
    /^\/admin\/login(\/|$)/,
    /^\/doctor-dashboard\/login(\/|$)/,
    /^\/video-call(\/|$)/,
]

const AppChrome = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname() ?? ''
    const immersive = IMMERSIVE_ROUTES.some((route) => route.test(pathname))

    if (immersive) return <>{children}</>

    return (
        <div className="mx-4 sm:mx-[10%]">
            <Navbar />
            {children}
            <Footer />
        </div>
    )
}

export default AppChrome
