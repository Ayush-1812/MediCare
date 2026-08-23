'use client'

import React from 'react'
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Loader2, AlertTriangle } from 'lucide-react'
import { useWebRTCCall } from '@/lib/webrtc/useWebRTCCall'

type Props = {
    appointmentId: string
    role: 'doctor' | 'patient'
    /** Who is on the other end, for the placeholder while they connect. */
    peerName: string
    onLeave: () => void
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

const VideoCallStage: React.FC<Props> = ({ appointmentId, role, peerName, onLeave }) => {
    const {
        status,
        error,
        hasTurn,
        micOn,
        camOn,
        sharingScreen,
        toggleMic,
        toggleCam,
        toggleScreenShare,
        localVideoRef,
        remoteVideoRef,
    } = useWebRTCCall({ appointmentId, role, enabled: true })

    const live = status === 'connected'

    return (
        <div className="relative h-full w-full bg-gray-900">
            {/* Remote peer fills the stage */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`h-full w-full object-cover ${live ? '' : 'opacity-0'}`}
            />

            {/* Placeholder until the peer's media actually arrives */}
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
                            <Loader2 className="w-9 h-9 text-white/70 mb-4 animate-spin" />
                            <p className="text-white text-lg font-semibold mb-1">{peerName}</p>
                            <p className="text-gray-300 text-sm">{STATUS_LABEL[status] ?? status}</p>
                        </>
                    )}
                </div>
            )}

            {/* Self view */}
            <div className="absolute top-4 right-4 w-32 sm:w-44 aspect-video rounded-xl overflow-hidden border-2 border-white/20 shadow-lg bg-black">
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                />
                {!camOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                        <VideoOff className="w-5 h-5 text-gray-400" />
                    </div>
                )}
            </div>

            {/* Connection quality / relay warning */}
            {status === 'reconnecting' && (
                <div className="absolute top-4 left-4 bg-amber-500/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                    Reconnecting…
                </div>
            )}
            {!hasTurn && status === 'failed' && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/70 text-gray-200 text-xs px-3 py-2 rounded-lg max-w-sm text-center">
                    No TURN relay is configured. Some networks cannot connect peer-to-peer.
                </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur px-4 py-3 rounded-2xl">
                <button
                    onClick={toggleMic}
                    aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        micOn ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                >
                    {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>

                <button
                    onClick={toggleCam}
                    aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        camOn ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                >
                    {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>

                <button
                    onClick={toggleScreenShare}
                    aria-label={sharingScreen ? 'Stop sharing screen' : 'Share screen'}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        sharingScreen ? 'bg-primary text-white' : 'bg-white/15 hover:bg-white/25 text-white'
                    }`}
                >
                    <MonitorUp className="w-5 h-5" />
                </button>

                <button
                    onClick={onLeave}
                    aria-label="Leave call"
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                    <PhoneOff className="w-5 h-5" />
                </button>
            </div>
        </div>
    )
}

export default VideoCallStage
