'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getConsultationDetails, startConsultation } from '@/app/actions/consultationActions'
import ConsultationPanel from '@/components/ConsultationPanel'
import ConsultationSummary from '@/components/ConsultationSummary'
import { toast } from 'react-toastify'

type ConsultationStatus = 'loading' | 'waiting' | 'active' | 'ended'

const VideoCall = () => {
    const { appointmentId } = useParams()
    const router = useRouter()
    const jitsiContainerRef = useRef<HTMLDivElement>(null)

    const [meetingId, setMeetingId] = useState<string | null>(null)
    const [appointment, setAppointment] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [isDoctor, setIsDoctor] = useState(false)
    const [status, setStatus] = useState<ConsultationStatus>('loading')
    const [jitsiApi, setJitsiApi] = useState<any>(null)

    useEffect(() => {
        const docToken = localStorage.getItem('docToken')
        setIsDoctor(!!docToken)

        fetchDetails()
        const interval = setInterval(fetchDetails, 5000)
        return () => clearInterval(interval)
    }, [appointmentId])

    const fetchDetails = async () => {
        const res = await getConsultationDetails(appointmentId as string)

        if (res?.success && res.appointment) {
            setAppointment(res.appointment)
            setMeetingId(res.appointment.meetingId ?? null)

            if (res.appointment.cancelled) {
                setStatus('ended')
            } else if (res.appointment.meetingId) {
                setStatus('active')
            } else {
                setStatus('waiting')
            }
        }

        setLoading(false)
    }

    const handleStartConsultation = async () => {
        if (!isDoctor) return

        const res = await startConsultation(appointmentId as string)
        if (res.success) {
            toast.success('Consultation started')
            fetchDetails()
        } else {
            toast.error(res.message || 'Failed to start consultation')
        }
    }

    // Initialize Jitsi
    useEffect(() => {
        if (status !== 'active' || !meetingId || jitsiApi) return

        const domain = 'meet.jit.si'

        const options = {
            roomName: meetingId,
            width: '100%',
            height: '100%',
            parentNode: jitsiContainerRef.current,
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
                    'mute-everyone',
                ],
            },
        }

        const script = document.createElement('script')
        script.src = `https://${domain}/external_api.js`
        script.async = true

        script.onload = () => {
            // @ts-ignore
            const api = new window.JitsiMeetExternalAPI(domain, options)
            setJitsiApi(api)

            api.addEventListener('videoConferenceLeft', () => {
                if (!isDoctor) router.back()
            })

            api.addEventListener('readyToClose', () => {
                if (!isDoctor) router.back()
            })
        }

        document.body.appendChild(script)

        return () => {
            if (jitsiApi) jitsiApi.dispose()
            document.body.removeChild(script)
        }
    }, [status, meetingId])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                Loading Consultation...
            </div>
        )
    }

    // 🟢 Consultation Ended
    if (status === 'ended') {
        return (
            <div className="min-h-screen bg-gray-50 py-10 px-4">
                <ConsultationSummary
                    appointment={appointment}
                    role={isDoctor ? 'doctor' : 'patient'}
                />
            </div>
        )
    }

    // 🟡 Waiting Room
    if (status === 'waiting') {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
                {isDoctor ? (
                    <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            Ready to Start?
                        </h1>
                        <p className="text-gray-600 mb-6">
                            Start the consultation when you are ready.
                        </p>
                        <button
                            onClick={handleStartConsultation}
                            className="w-full bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition"
                        >
                            Start Video Consultation
                        </button>
                    </div>
                ) : (
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <h1 className="text-xl font-semibold text-gray-900">
                            Waiting for Doctor
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Please stay on this page.
                        </p>
                    </div>
                )}
            </div>
        )
    }

    // 🔴 Active Consultation
    return (
        <div className="h-screen w-full bg-black flex overflow-hidden">
            {/* Video */}
            <div className={`flex-1 relative ${isDoctor ? 'w-2/3' : 'w-full'}`}>
                <div ref={jitsiContainerRef} className="h-full w-full" />
            </div>

            {/* Doctor Panel */}
            {isDoctor && (
                <div className="w-[400px] h-full bg-white">
                    <ConsultationPanel
                        appointmentId={appointmentId as string}
                        startTime={appointment?.slotTime}
                        onEndCall={fetchDetails}
                    />
                </div>
            )}
        </div>
    )
}

export default VideoCall
