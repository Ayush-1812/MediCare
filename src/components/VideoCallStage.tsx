'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    MonitorUp,
    PhoneOff,
    Loader2,
    AlertTriangle,
    Maximize,
    Minimize,
    User,
} from 'lucide-react'
import { useWebRTCCall } from '@/lib/webrtc/useWebRTCCall'

type Props = {
    appointmentId: string
    role: 'doctor' | 'patient'
    /** Who is on the other end, for the placeholder while they connect. */
    peerName: string
    /** This side's own display name, shown on the self-view tile. */
    selfName?: string
    onLeave: () => void
    /** The other side closed the consultation for good. */
    onConsultationEnded?: () => void
    /** Lets the parent trigger the "consultation is over" broadcast. */
    onReady?: (api: { announceConsultationEnded: () => void }) => void
}

const STATUS_LABEL: Record<string, string> = {
    idle: 'Starting…',
    'requesting-media': 'Waiting for camera and microphone…',
    'waiting-for-peer': 'Waiting for the other person to join…',
    connecting: 'Connecting…',
    connected: 'Connected',
    reconnecting: 'Connection unstable — reconnecting…',
    failed: 'Call failed',
}

/** Circular control button, sized and spaced like Meet's bottom bar. */
const ControlButton: React.FC<{
    onClick: () => void
    label: string
    active?: boolean
    danger?: boolean
    children: React.ReactNode
}> = ({ onClick, label, active = true, danger = false, children }) => (
    <button
        onClick={onClick}
        aria-label={label}
        title={label}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            danger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : active
                  ? 'bg-white/15 hover:bg-white/25 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
        }`}
    >
        {children}
    </button>
)

const VideoCallStage: React.FC<Props> = ({
    appointmentId,
    role,
    peerName,
    selfName,
    onLeave,
    onConsultationEnded,
    onReady,
}) => {
    const shellRef = useRef<HTMLDivElement>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)

    const {
        status,
        error,
        hasTurn,
        micOn,
        camOn,
        sharingScreen,
        announceConsultationEnded,
        toggleMic,
        toggleCam,
        toggleScreenShare,
        localVideoRef,
        remoteVideoRef,
    } = useWebRTCCall({ appointmentId, role, enabled: true, onConsultationEnded })

    // Hand the broadcast function up so the doctor's panel can fire it when the report is
    // submitted. Passed through a ref-stable callback rather than rendered state.
    useEffect(() => {
        onReady?.({ announceConsultationEnded })
    }, [onReady, announceConsultationEnded])

    const live = status === 'connected'

    // ─── Fullscreen ──────────────────────────────────────────────────────────
    const toggleFullscreen = useCallback(async () => {
        const shell = shellRef.current
        if (!shell) return
        try {
            if (document.fullscreenElement) await document.exitFullscreen()
            else await shell.requestFullscreen()
        } catch {
            // Denied by the browser (needs a user gesture, or is disabled by policy) —
            // not worth interrupting a live consultation over.
        }
    }, [])

    // The user can also leave fullscreen with Esc or the browser's own control, which
    // never routes through our button — so the icon tracks the document, not the click.
    useEffect(() => {
        const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
    }, [])

    return (
        <div ref={shellRef} className="relative h-full w-full bg-[#202124] overflow-hidden">
            {/* ── Remote peer: the main stage ──────────────────────────────── */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`h-full w-full object-cover transition-opacity duration-300 ${live ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Name pill over the main stage, Meet-style */}
            {live && (
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur text-white text-sm font-medium px-3 py-1.5 rounded-lg">
                    {peerName}
                </div>
            )}

            {/* ── Placeholder until the peer's media arrives ───────────────── */}
            {!live && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                    {status === 'failed' ? (
                        <>
                            <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
                            <p className="text-white text-lg font-semibold mb-1">
                                {error?.isPermission ? 'Camera access blocked' : 'Call failed'}
                            </p>
                            <p className="text-gray-300 text-sm max-w-md">{error?.message}</p>
                        </>
                    ) : (
                        <>
                            {/* Avatar circle with the peer's initial, as Meet shows before video */}
                            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-5">
                                {peerName ? (
                                    <span className="text-white text-3xl font-semibold">
                                        {peerName.trim().charAt(0).toUpperCase()}
                                    </span>
                                ) : (
                                    <User className="w-10 h-10 text-white/70" />
                                )}
                            </div>
                            <p className="text-white text-lg font-semibold mb-2">{peerName}</p>
                            <p className="text-gray-300 text-sm flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {STATUS_LABEL[status] ?? status}
                            </p>
                        </>
                    )}
                </div>
            )}

            {/* ── Self view ────────────────────────────────────────────────── */}
            <div className="absolute top-4 right-4 w-32 sm:w-48 aspect-video rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-[#3c4043]">
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover ${camOn ? '' : 'invisible'}`}
                />
                {!camOn && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <VideoOff className="w-6 h-6 text-gray-400" />
                    </div>
                )}
                <div className="absolute bottom-1 left-2 flex items-center gap-1">
                    <span className="text-white text-[11px] font-medium drop-shadow">
                        {selfName ? `${selfName} (You)` : 'You'}
                    </span>
                    {!micOn && <MicOff className="w-3 h-3 text-red-400" />}
                </div>
            </div>

            {/* ── Status banners ───────────────────────────────────────────── */}
            {status === 'reconnecting' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                    Reconnecting…
                </div>
            )}
            {!hasTurn && status === 'failed' && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/70 text-gray-200 text-xs px-3 py-2 rounded-lg max-w-sm text-center">
                    No TURN relay is configured. Some networks cannot connect peer-to-peer.
                </div>
            )}

            {/* ── Control bar ──────────────────────────────────────────────── */}
            <div className="absolute bottom-0 inset-x-0 pb-5 pt-10 bg-gradient-to-t from-black/70 to-transparent">
                <div className="flex items-center justify-center gap-3">
                    <ControlButton
                        onClick={toggleMic}
                        active={micOn}
                        label={micOn ? 'Mute microphone' : 'Unmute microphone'}
                    >
                        {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                    </ControlButton>

                    <ControlButton
                        onClick={toggleCam}
                        active={camOn}
                        label={camOn ? 'Turn camera off' : 'Turn camera on'}
                    >
                        {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                    </ControlButton>

                    <button
                        onClick={toggleScreenShare}
                        aria-label={sharingScreen ? 'Stop sharing screen' : 'Share screen'}
                        title={sharingScreen ? 'Stop sharing screen' : 'Share screen'}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                            sharingScreen
                                ? 'bg-primary text-white'
                                : 'bg-white/15 hover:bg-white/25 text-white'
                        }`}
                    >
                        <MonitorUp className="w-5 h-5" />
                    </button>

                    <ControlButton
                        onClick={toggleFullscreen}
                        label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    >
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </ControlButton>

                    <ControlButton onClick={onLeave} danger label="Leave call">
                        <PhoneOff className="w-5 h-5" />
                    </ControlButton>
                </div>
            </div>
        </div>
    )
}

export default VideoCallStage
