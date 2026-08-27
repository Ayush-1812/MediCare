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
import PatientNotesPanel from '@/components/PatientNotesPanel'
import VideoCallStage from '@/components/VideoCallStage'
import { consultationJoinState, formatSlotDateTime } from '@/lib/appointment'
import { ArrowLeft, RefreshCw, Video, VideoOff } from 'lucide-react'
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
    patientNotes: string | null
    followUpDate: string | null
}

const VideoCall = () => {
    const params = useParams()
    const appointmentId = Array.isArray(params.appointmentId)
        ? params.appointmentId[0]
        : (params.appointmentId as string)
    const router = useRouter()

    const [consultation, setConsultation] = useState<Consultation | null>(null)
    const [role, setRole] = useState<ConsultationRole | null>(null)
    const [status, setStatus] = useState<ConsultationStatus>('loading')
    const [error, setError] = useState<string | null>(null)
    const [starting, setStarting] = useState(false)

    const isDoctor = role === 'doctor'

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

    // Poll while waiting to be let in, and — for the patient — while the call is live too.
    //
    // Polling used to stop the moment the call started, which meant that when the doctor
    // submitted their report and completed the appointment, the patient's page never found
    // out: they sat in a dead room with a frozen video and no way forward. The socket
    // 'consultation-ended' broadcast below handles the common case instantly; this slower
    // poll is the safety net for when that signal is missed (socket dropped, patient
    // reconnecting, a tab restored from sleep).
    //
    // The doctor is deliberately excluded: their own page already refreshes when they end
    // the consultation, and polling underneath the form they are typing into is wasteful.
    useEffect(() => {
        const shouldPoll = status === 'waiting' || (status === 'active' && role === 'patient')
        if (!shouldPoll) return

        const interval = setInterval(fetchDetails, status === 'waiting' ? 5000 : 10000)
        return () => clearInterval(interval)
    }, [status, role, fetchDetails])

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

    const backHref = isDoctor ? '/doctor-dashboard/appointments' : '/my-appointments'
    const leaveRoom = () => router.push(backHref)

    // Set by VideoCallStage once its socket is up, so the doctor's panel can tell the
    // patient the consultation is over the instant the report is submitted.
    const announceEndedRef = useRef<(() => void) | null>(null)
    const handleStageReady = useCallback((api: { announceConsultationEnded: () => void }) => {
        announceEndedRef.current = api.announceConsultationEnded
    }, [])

    /** The doctor finished and saved the report. */
    const handleConsultationEnded = useCallback(async () => {
        announceEndedRef.current?.()
        await fetchDetails()
    }, [fetchDetails])

    /** The other side ended it — move this side to the report. */
    const handleRemoteEnded = useCallback(() => {
        toast.info('The doctor has ended the consultation')
        fetchDetails()
    }, [fetchDetails])

    const slotLabel = consultation
        ? formatSlotDateTime(consultation.slotDate, consultation.slotTime)
        : ''
    const otherParty = consultation
        ? isDoctor
            ? consultation.patientName || 'Patient'
            : consultation.doctorName || 'Doctor'
        : ''

    // The appointments list disables the join button until 15 minutes before the slot, but
    // that only stops a click — a bookmarked or shared link still reaches this page
    // directly. Without this, a patient arriving early saw "Waiting for the doctor", which
    // reads as "the doctor is late" rather than "you're early".
    const joinState = consultation && !isDoctor ? consultationJoinState(consultation) : null
    const tooEarly = joinState !== null && !joinState.canJoin && !joinState.closed

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
                        {isDoctor ? 'Ready to start?' : tooEarly ? 'Not open yet' : 'Waiting for the doctor'}
                    </h1>
                    <p className="text-gray-600 mb-1">
                        {isDoctor
                            ? `Consultation with ${otherParty}`
                            : tooEarly
                              ? joinState?.reason
                              : `${otherParty} will admit you shortly`}
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
        <div className="h-screen w-full bg-[#202124] flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 relative min-h-0">
                {role && (
                    <VideoCallStage
                        appointmentId={appointmentId}
                        role={role}
                        peerName={otherParty}
                        selfName={consultation?.displayName}
                        onLeave={leaveRoom}
                        onConsultationEnded={handleRemoteEnded}
                        onReady={handleStageReady}
                    />
                )}
            </div>

            {/* Both sides get a side panel: the doctor writes the clinical report, the
                patient keeps their own notes. Previously only the doctor had one, so the
                patient had nowhere to write anything down mid-consultation. */}
            <div className="w-full lg:w-[400px] h-1/2 lg:h-full bg-white shrink-0">
                {isDoctor ? (
                    <ConsultationPanel
                        appointmentId={appointmentId}
                        startTime={consultation?.startTime ?? undefined}
                        onEndCall={handleConsultationEnded}
                    />
                ) : (
                    <PatientNotesPanel
                        appointmentId={appointmentId}
                        initialNotes={consultation?.patientNotes}
                        doctorName={consultation?.doctorName ?? undefined}
                    />
                )}
            </div>
        </div>
    )
}

export default VideoCall
