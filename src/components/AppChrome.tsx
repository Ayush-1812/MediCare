'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

/**
 * Site chrome (navbar, footer and the centred content gutter) for every page that wants it.
 *
 * The consultation room does not: it is a full-viewport surface, and wrapping it in the
 * marketing layout pushed its control bar — mute, camera, hang up — below the fold where
 * nobody could reach it mid-call.
 */
const IMMERSIVE_ROUTES = [/^\/video-call(\/|$)/]

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
