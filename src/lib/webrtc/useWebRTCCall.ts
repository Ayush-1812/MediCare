'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { getIceServers } from '@/app/actions/webrtcActions'

/**
 * One-to-one WebRTC consultation between a doctor and a patient.
 *
 * Media flows directly between the two browsers; the Socket.IO channel carries only the
 * introductions (SDP + ICE). The doctor is always the caller and the patient always the
 * callee — fixing the roles this way removes SDP "glare" entirely, so neither side needs
 * the perfect-negotiation rollback dance.
 */

export type CallStatus =
    | 'idle'
    | 'requesting-media'
    | 'waiting-for-peer'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'failed'

export type CallError = {
    message: string
    /** True when the browser denied camera/mic — the user has to fix this, not a retry. */
    isPermission: boolean
}

type SignalPayload =
    | { kind: 'offer'; sdp: RTCSessionDescriptionInit }
    | { kind: 'answer'; sdp: RTCSessionDescriptionInit }
    | { kind: 'candidate'; candidate: RTCIceCandidateInit }

type Options = {
    appointmentId: string
    role: 'doctor' | 'patient'
    /** Hold off until the consultation room is actually open. */
    enabled: boolean
    /**
     * The other side closed the consultation for good (the doctor submitted the report).
     * Distinct from the peer merely leaving — this room is finished.
     */
    onConsultationEnded?: () => void
}

export function useWebRTCCall({ appointmentId, role, enabled, onConsultationEnded }: Options) {
    const [status, setStatus] = useState<CallStatus>('idle')
    const [error, setError] = useState<CallError | null>(null)
    const [peerPresent, setPeerPresent] = useState(false)
    const [micOn, setMicOn] = useState(true)
    const [camOn, setCamOn] = useState(true)
    const [sharingScreen, setSharingScreen] = useState(false)
    const [hasTurn, setHasTurn] = useState(true)

    const localStreamRef = useRef<MediaStream | null>(null)
    const remoteStreamRef = useRef<MediaStream | null>(null)
    const localVideoRef = useRef<HTMLVideoElement | null>(null)
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null)

    const socketRef = useRef<Socket | null>(null)
    const pcRef = useRef<RTCPeerConnection | null>(null)
    const iceServersRef = useRef<RTCIceServer[]>([])
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null)

    // The live screen-capture track, kept only while sharing. Without this reference,
    // stopping a share could swap the outgoing video back to the camera but had no way to
    // call `.stop()` on the capture itself — it kept running invisibly, and the browser's
    // "you are sharing your screen" indicator stayed on until the tab was closed.
    const screenTrackRef = useRef<MediaStreamTrack | null>(null)

    // Held in a ref, not read directly in the effect: a parent that re-creates this
    // callback each render would otherwise change the effect's dependencies and tear the
    // whole call down mid-consultation — the same failure `hasTurnRef` below exists to
    // avoid. The ref is refreshed on every render so it never goes stale.
    const onConsultationEndedRef = useRef(onConsultationEnded)
    onConsultationEndedRef.current = onConsultationEnded

    // Mirrors `hasTurn` for use inside callbacks. Reading the state value there instead
    // made `createPeerConnection` — and through it the whole setup effect — depend on a
    // piece of state that setup itself writes, so discovering "no TURN configured"
    // re-ran the effect in the middle of negotiating and intermittently produced a
    // connected call carrying no media at all.
    const hasTurnRef = useRef(true)

    // ICE candidates routinely arrive before the answer that lets us apply them. Applying
    // one early throws and the connection silently never completes, so they queue here.
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([])
    const makingOfferRef = useRef(false)

    // Identifies the current run of the setup effect. React StrictMode mounts effects
    // twice in development (mount → cleanup → mount), and without this the first run's
    // teardown tears down the second run's camera and socket.
    const runIdRef = useRef(0)

    // One in-flight getUserMedia per hook. Two concurrent requests for the same device
    // race, and the loser comes back as NotFoundError — an intermittent "no camera found"
    // on a machine that plainly has one.
    const mediaPromiseRef = useRef<Promise<MediaStream> | null>(null)

    const acquireMedia = useCallback(() => {
        if (!mediaPromiseRef.current) {
            mediaPromiseRef.current = (async () => {
                const constraints = {
                    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: { echoCancellation: true, noiseSuppression: true },
                }

                let lastError: unknown
                // A camera can be momentarily busy — still releasing from another tab or
                // app — and reports that as NotFoundError/NotReadableError even though the
                // device exists. One quick retry turns that transient into a working call
                // instead of "no camera found".
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        return await navigator.mediaDevices.getUserMedia(constraints)
                    } catch (error) {
                        lastError = error
                        const name = (error as DOMException)?.name
                        const transient =
                            name === 'NotFoundError' ||
                            name === 'NotReadableError' ||
                            name === 'AbortError'
                        // A denied permission never fixes itself by asking again.
                        if (!transient || attempt === 3) break
                        await new Promise((resolve) => setTimeout(resolve, attempt * 400))
                    }
                }
                throw lastError
            })()
        }
        return mediaPromiseRef.current
    }, [])

    const attachLocal = useCallback((stream: MediaStream) => {
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
    }, [])

    /** Tears down the peer connection but keeps local media and the socket alive. */
    const closePeer = useCallback(() => {
        pendingCandidates.current = []
        makingOfferRef.current = false
        if (pcRef.current) {
            pcRef.current.onicecandidate = null
            pcRef.current.ontrack = null
            pcRef.current.onconnectionstatechange = null
            pcRef.current.close()
            pcRef.current = null
        }
        remoteStreamRef.current = null
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    }, [])

    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection({ iceServers: iceServersRef.current })

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current?.emit('signal', {
                    kind: 'candidate',
                    candidate: event.candidate.toJSON(),
                } satisfies SignalPayload)
            }
        }

        pc.ontrack = (event) => {
            // A single remote stream carries both tracks; reuse it so the <video> element
            // is not reassigned mid-call (which restarts playback and flashes black).
            const [stream] = event.streams
            if (!stream) return
            remoteStreamRef.current = stream
            if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
                remoteVideoRef.current.srcObject = stream
            }
        }

        pc.onconnectionstatechange = () => {
            switch (pc.connectionState) {
                case 'connected':
                    setStatus('connected')
                    setError(null)
                    break
                case 'disconnected':
                    setStatus('reconnecting')
                    break
                case 'failed':
                    setStatus('failed')
                    setError({
                        message: hasTurnRef.current
                            ? 'The connection dropped and could not be re-established.'
                            : 'Could not establish a direct connection. This network needs a TURN relay.',
                        isPermission: false,
                    })
                    break
                default:
                    break
            }
        }

        const stream = localStreamRef.current
        if (stream) {
            for (const track of stream.getTracks()) pc.addTrack(track, stream)
        } else {
            // Negotiating without tracks yields an SDP with no media lines: the call
            // reaches "connected" and then sits there silently carrying nothing, which is
            // far harder to diagnose than a loud failure.
            console.error('[webrtc] peer connection created before local media was ready')
        }

        pcRef.current = pc
        return pc
    }, [])

    const makeOffer = useCallback(async () => {
        if (role !== 'doctor') return
        if (makingOfferRef.current) return
        // The socket is only opened after media is acquired, so this should hold; bail
        // rather than send an offer that would establish a call with nothing in it.
        if (!localStreamRef.current) {
            console.error('[webrtc] refusing to offer before local media is ready')
            return
        }
        makingOfferRef.current = true

        try {
            setStatus('connecting')
            const pc = pcRef.current ?? createPeerConnection()
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            socketRef.current?.emit('signal', {
                kind: 'offer',
                sdp: pc.localDescription!.toJSON(),
            } satisfies SignalPayload)
        } catch (err) {
            console.error('[webrtc] failed to create offer', err)
            setStatus('failed')
            setError({ message: 'Could not start the call.', isPermission: false })
        } finally {
            makingOfferRef.current = false
        }
    }, [role, createPeerConnection])

    const handleSignal = useCallback(
        async (payload: SignalPayload) => {
            try {
                if (payload.kind === 'offer') {
                    // Only the patient answers. A fresh offer means the doctor reloaded, so
                    // start from a clean peer connection rather than renegotiating a stale one.
                    if (role !== 'patient') return
                    closePeer()
                    const pc = createPeerConnection()
                    setStatus('connecting')

                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
                    for (const candidate of pendingCandidates.current) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate))
                    }
                    pendingCandidates.current = []

                    const answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    socketRef.current?.emit('signal', {
                        kind: 'answer',
                        sdp: pc.localDescription!.toJSON(),
                    } satisfies SignalPayload)
                    return
                }

                if (payload.kind === 'answer') {
                    const pc = pcRef.current
                    if (!pc || pc.signalingState !== 'have-local-offer') return
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
                    for (const candidate of pendingCandidates.current) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate))
                    }
                    pendingCandidates.current = []
                    return
                }

                // candidate
                const pc = pcRef.current
                if (!pc || !pc.remoteDescription) {
                    pendingCandidates.current.push(payload.candidate)
                    return
                }
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
            } catch (err) {
                console.error('[webrtc] signal handling failed', err)
            }
        },
        [role, closePeer, createPeerConnection],
    )

    // ─── Lifecycle ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!enabled || !appointmentId) return

        const myRun = ++runIdRef.current
        const superseded = () => runIdRef.current !== myRun

        const start = async () => {
            setStatus('requesting-media')
            setError(null)

            // 1. Camera and microphone.
            let stream: MediaStream
            try {
                stream = await acquireMedia()
            } catch (err) {
                mediaPromiseRef.current = null
                if (superseded()) return
                const name = (err as DOMException)?.name
                const denied = name === 'NotAllowedError' || name === 'SecurityError'
                setStatus('failed')
                setError({
                    message: denied
                        ? 'Camera and microphone access was blocked. Allow it in your browser, then reload.'
                        : name === 'NotFoundError'
                          ? 'No camera or microphone was found on this device.'
                          : 'Could not access your camera or microphone.',
                    isPermission: denied,
                })
                return
            }
            // Superseded runs must NOT stop the tracks: the run that replaced this one is
            // using the very same stream, and stopping it here is what left the call
            // staring at a dead camera.
            if (superseded()) return

            attachLocal(stream)
            cameraTrackRef.current = stream.getVideoTracks()[0] ?? null

            // 2. ICE servers (TURN credentials never reach the public bundle).
            try {
                const config = await getIceServers()
                if (superseded()) return
                iceServersRef.current = config.iceServers
                hasTurnRef.current = config.hasTurn
                setHasTurn(config.hasTurn)
            } catch {
                iceServersRef.current = [{ urls: 'stun:stun.l.google.com:19302' }]
            }

            // 3. Signaling channel.
            // A superseded run must not open a second socket: the room holds exactly two
            // participants, so a stray duplicate from this same person fills it and locks
            // the other side out.
            if (superseded() || socketRef.current) return

            const socket = io({
                path: '/api/socket',
                auth: { appointmentId },
                transports: ['websocket', 'polling'],
            })
            socketRef.current = socket
            setStatus('waiting-for-peer')

            socket.on('connect_error', (err) => {
                setStatus('failed')
                setError({ message: err.message || 'Could not reach the signaling server.', isPermission: false })
            })

            socket.on('replaced', () => {
                // The server evicts the older of two same-role connections (e.g. this
                // appointment's call opened in a second tab) rather than refusing the new
                // one — so this side must stop cleanly instead of fighting to reconnect.
                setStatus('failed')
                setError({
                    message: 'This consultation was opened in another tab or window.',
                    isPermission: false,
                })
            })

            socket.on('joined', ({ peerPresent: present }: { peerPresent: boolean }) => {
                setPeerPresent(present)
                if (present) makeOffer()
            })

            socket.on('peer-joined', () => {
                setPeerPresent(true)
                makeOffer()
            })

            socket.on('peer-left', () => {
                setPeerPresent(false)
                closePeer()
                setStatus('waiting-for-peer')
            })

            // The doctor closed the consultation. Tear the media down immediately rather
            // than leaving a frozen last frame on screen, then let the page move this side
            // to the report.
            socket.on('consultation-ended', () => {
                setPeerPresent(false)
                closePeer()
                onConsultationEndedRef.current?.()
            })

            socket.on('signal', handleSignal)
        }

        start()

        return () => {
            // Deferred by a tick so a StrictMode remount can claim ownership first. On a
            // genuine unmount no new run appears and the teardown proceeds as normal; on
            // the development double-mount this run is already superseded and skips it,
            // leaving the live camera and socket alone.
            setTimeout(() => {
                // Reading the *current* ref here is the whole point — a value captured at
                // mount could not tell us whether a newer run has taken over since.
                // eslint-disable-next-line react-hooks/exhaustive-deps
                if (runIdRef.current !== myRun) return

                socketRef.current?.emit('leave')
                socketRef.current?.disconnect()
                socketRef.current = null
                closePeer()
                for (const track of localStreamRef.current?.getTracks() ?? []) track.stop()
                localStreamRef.current = null
                mediaPromiseRef.current = null
                // Leaving mid-share must not leave the screen capture running in the
                // background after the call itself has ended.
                screenTrackRef.current?.stop()
                screenTrackRef.current = null
                setStatus('idle')
            }, 0)
        }
    }, [enabled, appointmentId, attachLocal, acquireMedia, makeOffer, handleSignal, closePeer])

    // ─── Controls ────────────────────────────────────────────────────────────
    const toggleMic = useCallback(() => {
        const track = localStreamRef.current?.getAudioTracks()[0]
        if (!track) return
        track.enabled = !track.enabled
        setMicOn(track.enabled)
    }, [])

    const toggleCam = useCallback(() => {
        const track = localStreamRef.current?.getVideoTracks()[0]
        if (!track) return
        track.enabled = !track.enabled
        setCamOn(track.enabled)
    }, [])

    const toggleScreenShare = useCallback(async () => {
        const pc = pcRef.current
        const sender = pc?.getSenders().find((s) => s.track?.kind === 'video')
        if (!sender) return

        if (sharingScreen) {
            const camera = cameraTrackRef.current
            if (camera) await sender.replaceTrack(camera)
            // Swapping the sender's track back to the camera does not stop the capture
            // itself — the display track keeps running (and the browser keeps showing its
            // "sharing" indicator) until something calls .stop() on it explicitly.
            screenTrackRef.current?.stop()
            screenTrackRef.current = null
            setSharingScreen(false)
            return
        }

        try {
            const display = await navigator.mediaDevices.getDisplayMedia({ video: true })
            const screenTrack = display.getVideoTracks()[0]
            if (!screenTrack) return
            await sender.replaceTrack(screenTrack)
            screenTrackRef.current = screenTrack
            setSharingScreen(true)
            // Chrome's own "Stop sharing" bar bypasses our button, so restore on track end.
            // The track has already ended itself here, so only the ref needs clearing.
            screenTrack.onended = () => {
                const camera = cameraTrackRef.current
                if (camera) sender.replaceTrack(camera)
                screenTrackRef.current = null
                setSharingScreen(false)
            }
        } catch {
            // The user dismissed the picker — not an error worth surfacing.
        }
    }, [sharingScreen])

    /**
     * Tells the other side the consultation is over. Called by the doctor once the report
     * is saved, so the patient leaves the room immediately instead of waiting for a poll.
     */
    const announceConsultationEnded = useCallback(() => {
        socketRef.current?.emit('consultation-ended')
    }, [])

    return {
        status,
        error,
        peerPresent,
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
    }
}
