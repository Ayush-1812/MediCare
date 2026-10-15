'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import VoiceReceptionist from '@/components/Voice/VoiceReceptionist'

/**
 * Site chrome — navbar, footer and the centred content gutter — for pages that want it.
 *
 * Some pages are full-viewport surfaces that the marketing layout actively harms:
 *
 *   · The auth pages are a split screen (hero panel one side, form the other), but the
 *     root layout's `mx-4 sm:mx-[10%]` gutter squeezed them into the middle 80% and the
 *     navbar stacked a second "Login / Create Account" pair right above the login form.
 *   · The consultation room needs the whole window — wrapped in the gutter, its control
 *     bar (mute, camera, hang up) sat below the fold, unreachable mid-call.
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
            {/*
              Mounted on the non-immersive branch only, which is exactly the behaviour the
              voice feature needs: the consultation room and the auth pages are immersive,
              so the receptionist cannot be opened while a video call owns the microphone,
              and it never appears over a login form. The gateway refuses a mid-consultation
              session as well — this is the first of the two defences, not the only one.
            */}
            <VoiceReceptionist />
        </div>
    )
}

export default AppChrome
