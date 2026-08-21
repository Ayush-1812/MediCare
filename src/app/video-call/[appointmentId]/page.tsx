'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    getConsultationDetails,
    startConsultation,
    type ConsultationRole,
} from '@/app/actions/consultationActions'
import ConsultationPanel from '@/components/ConsultationPanel'
import ConsultationSummary from '@/components/ConsultationSummary'
import { formatSlotDateTime } from '@/lib/appointment'
import { ArrowLeft, ExternalLink, RefreshCw, Video, VideoOff } from 'lucide-react'
import { toast } from 'react-toastify'

type ConsultationStatus = 'loading' | 'denied' | 'waiting' | 'active' | 'ended'

type Consultation = {
    id: string
    slotDate: string
    slotTime: string
    patientName: string
    doctorName: string
    displayName: string
    meetingId: string | null
    cancelled: boolean
    isCompleted: boolean
    startTime: string | null
    endTime: string | null
    duration: number | null
    diagnosis: string | null
    prescription: string | null
    notes: string | null
    followUpDate: string | null
}

const JITSI_DOMAIN = process.env.NEXT_PUBLIC_JITSI_DOMAIN || 'meet.jit.si'

/**
 * The slice of Jitsi's `external_api.js` this page actually uses. The library ships no
 * types, so this stands in for them rather than letting `any` leak through the file.
 */
type JitsiApi = {
    addEventListener: (event: string, handler: () => void) => void
    dispose: () => void
}

type JitsiApiConstructor = new (domain: string, options: Record<string, unknown>) => JitsiApi

/** The constructor the script attaches to `window`, absent until the script has loaded. */
function jitsiGlobal(): JitsiApiConstructor | undefined {
    return (window as unknown as { JitsiMeetExternalAPI?: JitsiApiConstructor }).JitsiMeetExternalAPI
}

/**
 * Loads Jitsi's `external_api.js` once per page load.
 *
 * The old code appended a fresh <script> on every join and removed it again in cleanup,
 * which both re-downloaded the library and could throw `NotFoundError` when React ran the
 * cleanup twice. Caching the promise keeps a single tag in the document.
 */
let jitsiScript: Promise<JitsiApiConstructor> | null = null

function loadJitsi(domain: string): Promise<JitsiApiConstructor> {
    if (typeof window === 'undefined') return Promise.reject(new Error('Not in a browser'))

    const existing = jitsiGlobal()
    if (existing) return Promise.resolve(existing)
    if (jitsiScript) return jitsiScript

    jitsiScript = new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `https://${domain}/external_api.js`
        script.async = true
        script.onload = () => {
            const api = jitsiGlobal()
            if (api) resolve(api)
            else reject(new Error('The video library loaded but did not initialise.'))
        }
        script.onerror = () => {
            // Let the next attempt retry instead of caching the rejection forever.
            jitsiScript = null
            reject(new Error(`Could not reach ${domain}. Check your connection or any blocker.`))
        }
        document.body.appendChild(script)
    })

    return jitsiScript
}

const VideoCall = () => {
    const params = useParams()
    const appointmentId = Array.isArray(params.appointmentId)
        ? params.appointmentId[0]
        : (params.appointmentId as string)
    const router = useRouter()

    const jitsiContainerRef = useRef<HTMLDivElement>(null)
    const apiRef = useRef<JitsiApi | null>(null)

    const [consultation, setConsultation] = useState<Consultation | null>(null)
    const [role, setRole] = useState<ConsultationRole | null>(null)
    const [status, setStatus] = useState<ConsultationStatus>('loading')
    const [error, setError] = useState<string | null>(null)
    const [embedError, setEmbedError] = useState<string | null>(null)
    const [hasLeft, setHasLeft] = useState(false)
    const [starting, setStarting] = useState(false)

    const isDoctor = role === 'doctor'
    const meetingId = consultation?.meetingId ?? null

    const fetchDetails = useCallback(async () => {
        const res = await getConsultationDetails(appointmentId)

        if (!res.success || !res.appointment) {
            setError(res.success ? 'Appointment not found' : res.message)
            setStatus('denied')
            return
        }

        const appointment = res.appointment as Consultation
        setConsultation(appointment)
        setRole(res.role)

        // A finished consultation shows its report — the old page only checked `cancelled`,
        // so once the doctor submitted the write-up both sides stayed stuck on a dead call.
        if (appointment.cancelled || appointment.isCompleted) setStatus('ended')
        else if (appointment.meetingId) setStatus('active')
        else setStatus('waiting')
    }, [appointmentId])

    useEffect(() => {
        if (!appointmentId) return
        fetchDetails()
    }, [appointmentId, fetchDetails])

    // Poll only while the patient is waiting to be let in. Polling through an active call
    // re-rendered the page every 5s for no benefit.
    useEffect(() => {
        if (status !== 'waiting') return
        const interval = setInterval(fetchDetails, 5000)
        return () => clearInterval(interval)
    }, [status, fetchDetails])

    const handleStartConsultation = async () => {
        setStarting(true)
        try {
            const res = await startConsultation(appointmentId)
            if (res.success) {
                toast.success('Consultation started')
                await fetchDetails()
            } else {
                toast.error(res.message)
            }
        } finally {
            setStarting(false)
        }
    }

    // ─── Jitsi lifecycle ─────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'active' || !meetingId || hasLeft) return

        const container = jitsiContainerRef.current
        if (!container) return

        let cancelled = false
        setEmbedError(null)

        loadJitsi(JITSI_DOMAIN)
            .then((JitsiMeetExternalAPI) => {
                if (cancelled) return

                const api = new JitsiMeetExternalAPI(JITSI_DOMAIN, {
                    roomName: meetingId,
                    width: '100%',
                    height: '100%',
                    parentNode: container,
                    userInfo: { displayName: consultation?.displayName ?? '' },
                    configOverwrite: {
                        startWithAudioMuted: true,
                        disableThirdPartyRequests: true,
                        prejoinPageEnabled: false,
                    },
                    interfaceConfigOverwrite: {
                        TOOLBAR_BUTTONS: [
                            'microphone',
                            'camera',
                            'desktop',
                            'fullscreen',
                            'hangup',
                            'chat',
                            'tileview',
                            'settings',
                        ],
                    },
                })

                apiRef.current = api

                const onLeave = () => setHasLeft(true)
                api.addEventListener('videoConferenceLeft', onLeave)
                api.addEventListener('readyToClose', onLeave)
            })
            .catch((err: Error) => {
                if (!cancelled) setEmbedError(err.message)
            })

        return () => {
            cancelled = true
            // `dispose()` was previously read off a state variable that was still null when
            // the cleanup closure was created, so the conference was never torn down and the
            // camera stayed on after leaving the page. A ref always holds the live instance.
            if (apiRef.current) {
                apiRef.current.dispose()
                apiRef.current = null
            }
        }
    }, [status, meetingId, hasLeft, consultation?.displayName])

    const leaveRoom = () => {
        if (apiRef.current) {
            apiRef.current.dispose()
            apiRef.current = null
        }
        router.push(isDoctor ? '/doctor-dashboard/appointments' : '/my-appointments')
    }

    const backHref = isDoctor ? '/doctor-dashboard/appointments' : '/my-appointments'
    const slotLabel = consultation
        ? formatSlotDateTime(consultation.slotDate, consultation.slotTime)
        : ''
    const otherParty = consultation
        ? isDoctor
            ? consultation.patientName || 'Patient'
            : consultation.doctorName || 'Doctor'
        : ''

    // ─── Loading ─────────────────────────────────────────────────────────────
    if (status === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                <p className="text-gray-600">Loading consultation…</p>
            </div>
        )
    }

    // ─── Not your consultation / signed out ──────────────────────────────────
    if (status === 'denied') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
                    <VideoOff className="w-10 h-10 text-red-400 mx-auto mb-3" />
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Consultation unavailable</h1>
                    <p className="text-gray-600 mb-6">{error ?? 'This consultation could not be opened.'}</p>
                    <button
                        onClick={() => router.push('/login')}
                        className="w-full bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition"
                    >
                        Sign in
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full mt-2 px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition"
                    >
                        Back to home
                    </button>
                </div>
            </div>
        )
    }

    // ─── Finished or cancelled ───────────────────────────────────────────────
    if (status === 'ended' && consultation) {
        return (
            <div className="min-h-screen bg-gray-50 py-10 px-4">
                {consultation.cancelled && (
                    <div className="max-w-3xl mx-auto mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm font-medium">
                        This appointment was cancelled, so the consultation room is closed.
                    </div>
                )}
                <ConsultationSummary appointment={consultation} role={isDoctor ? 'doctor' : 'patient'} />
            </div>
        )
    }

    // ─── Waiting room ────────────────────────────────────────────────────────
    if (status === 'waiting') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
                    <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                        <Video className="w-7 h-7 text-primary" />
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                        {isDoctor ? 'Ready to start?' : 'Waiting for the doctor'}
                    </h1>
                    <p className="text-gray-600 mb-1">
                        {isDoctor ? `Consultation with ${otherParty}` : `${otherParty} will admit you shortly`}
                    </p>
                    {slotLabel && <p className="text-sm text-gray-400 mb-6">{slotLabel}</p>}

                    {isDoctor ? (
                        <button
                            onClick={handleStartConsultation}
                            disabled={starting}
                            className="w-full bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary/90 disabled:bg-gray-300 transition"
                        >
                            {starting ? 'Starting…' : 'Start Video Consultation'}
                        </button>
                    ) : (
                        <>
                            <div className="flex items-center justify-center gap-2 text-primary mb-4">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                                <span className="text-sm font-medium">Checking every few seconds…</span>
                            </div>
                            <button
                                onClick={fetchDetails}
                                className="w-full flex items-center justify-center gap-2 border border-gray-200 px-6 py-3 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition"
                            >
                                <RefreshCw className="w-4 h-4" /> Check now
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => router.push(backHref)}
                        className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-gray-500 hover:bg-gray-50 transition"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to appointments
                    </button>
                </div>
            </div>
        )
    }

    // ─── Live consultation ───────────────────────────────────────────────────
    return (
        <div className="h-screen w-full bg-black flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 relative min-h-0">
                <div ref={jitsiContainerRef} className="h-full w-full" />

                {embedError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 p-6">
                        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
                            <VideoOff className="w-10 h-10 text-red-400 mx-auto mb-3" />
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Could not load the call</h2>
                            <p className="text-sm text-gray-600 mb-5">{embedError}</p>
                            <a
                                href={`https://${JITSI_DOMAIN}/${meetingId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition"
                            >
                                <ExternalLink className="w-4 h-4" /> Open the call in a new tab
                            </a>
                            <button
                                onClick={() => {
                                    setEmbedError(null)
                                    setHasLeft(false)
                                }}
                                className="w-full mt-2 px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                {hasLeft && !embedError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 p-6">
                        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
                            <h2 className="text-lg font-bold text-gray-900 mb-2">You left the consultation</h2>
                            <p className="text-sm text-gray-600 mb-5">
                                {isDoctor
                                    ? 'Rejoin the room, or complete the write-up on the right to finish this consultation.'
                                    : 'You can rejoin while the consultation is still running.'}
                            </p>
                            <button
                                onClick={() => setHasLeft(false)}
                                className="w-full bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition"
                            >
                                Rejoin call
                            </button>
                            <button
                                onClick={leaveRoom}
                                className="w-full mt-2 px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition"
                            >
                                Back to appointments
                            </button>
                        </div>
                    </div>
                )}

                {!hasLeft && !embedError && (
                    <button
                        onClick={leaveRoom}
                        className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/50 hover:bg-black/70 text-white text-sm font-medium px-3 py-2 rounded-lg backdrop-blur transition"
                    >
                        <ArrowLeft className="w-4 h-4" /> Leave
                    </button>
                )}
            </div>

            {isDoctor && (
                <div className="w-full lg:w-[400px] h-1/2 lg:h-full bg-white shrink-0">
                    <ConsultationPanel
                        appointmentId={appointmentId}
                        startTime={consultation?.startTime ?? undefined}
                        onEndCall={fetchDetails}
                    />
                </div>
            )}
        </div>
    )
}

export default VideoCall
