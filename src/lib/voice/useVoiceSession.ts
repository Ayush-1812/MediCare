'use client'

/**
 * Browser side of the voice receptionist.
 *
 * Owns three things that have to stay in step: the Socket.IO connection to the gateway,
 * a 16 kHz capture graph, and a 24 kHz playback graph. Two separate AudioContexts are
 * used on purpose — the Live API wants 16 kHz in and emits 24 kHz out, and letting the
 * browser resample at the context boundary is both faster and cleaner than any
 * resampling we could write by hand.
 *
 * The interruption contract matters more than anything else here. When the gateway says a
 * turn was interrupted, the playback queue is flushed inside the audio worklet and every
 * frame still arriving for that turn is dropped by `turnId` before it is ever decoded.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io, type Socket } from 'socket.io-client'
import {
    ClientEvent,
    ServerEvent,
    VOICE_NAMESPACE,
    decodeAudioFrame,
    type ErrorPayload,
    type InterruptedPayload,
    type ReadyPayload,
    type ReconnectingPayload,
    type ToolPayload,
    type TranscriptPayload,
    type TurnCompletePayload,
    type VoiceState,
} from './protocol'
import {
    CAPTURE_FRAME_SAMPLES,
    DEFAULT_LANGUAGE,
    INPUT_SAMPLE_RATE,
    OUTPUT_SAMPLE_RATE,
    type LanguageCode,
} from './config'

export type TranscriptEntry = {
    id: string
    role: 'user' | 'assistant'
    text: string
    final: boolean
    turnId: number
}

export type VoiceSessionError = ErrorPayload | null

export type UseVoiceSession = {
    state: VoiceState
    transcript: TranscriptEntry[]
    error: VoiceSessionError
    /** Short label for whatever tool is running, e.g. "Checking your appointments". */
    activity: string | null
    /** 0..1 mic level, for the listening indicator. */
    level: number
    muted: boolean
    language: LanguageCode
    connected: boolean
    start: () => Promise<void>
    stop: () => void
    interrupt: () => void
    sendText: (text: string) => void
    setMuted: (value: boolean) => void
    changeLanguage: (language: LanguageCode) => void
}

/** `getUserMedia` rejection names → our error codes and guidance the user can act on. */
function micError(error: unknown): ErrorPayload {
    const name = (error as { name?: string })?.name ?? ''
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return {
            code: 'mic_denied',
            message:
                'Microphone access was blocked. Allow it in your browser’s address bar, ' +
                'then try again — or type your question instead.',
            recoverable: true,
        }
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        return {
            code: 'mic_unavailable',
            message: 'No microphone was found. You can still type your question.',
            recoverable: true,
        }
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
        return {
            code: 'mic_in_use',
            message:
                'Your microphone is being used by another app or tab. Close it and try ' +
                'again, or type your question.',
            recoverable: true,
        }
    }
    return {
        code: 'internal',
        message: 'The microphone could not be started. You can still type your question.',
        recoverable: true,
    }
}

export function useVoiceSession(): UseVoiceSession {
    const router = useRouter()

    const [state, setState] = useState<VoiceState>('idle')
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
    const [error, setError] = useState<VoiceSessionError>(null)
    const [activity, setActivity] = useState<string | null>(null)
    const [level, setLevel] = useState(0)
    const [muted, setMutedState] = useState(false)
    const [language, setLanguage] = useState<LanguageCode>(DEFAULT_LANGUAGE)
    const [connected, setConnected] = useState(false)

    const socketRef = useRef<Socket | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const captureCtxRef = useRef<AudioContext | null>(null)
    const captureNodeRef = useRef<AudioWorkletNode | null>(null)
    const playbackCtxRef = useRef<AudioContext | null>(null)
    const playbackNodeRef = useRef<AudioWorkletNode | null>(null)

    /**
     * The turn the client believes is current. Audio frames tagged with anything lower
     * are stale — they were already in flight when the user interrupted — and are dropped
     * without being decoded or queued.
     */
    const currentTurnRef = useRef(1)
    /** Throttles level updates; at 50 frames a second React would re-render constantly. */
    const lastLevelPushRef = useRef(0)

    // ── Teardown ────────────────────────────────────────────────────────────

    const releaseAudio = useCallback(() => {
        // Tracks are stopped explicitly, not just disconnected: the browser keeps the
        // recording indicator (and the device claim) alive until every track is stopped,
        // and a consultation cannot acquire the mic while we still hold it.
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null

        captureNodeRef.current?.disconnect()
        captureNodeRef.current = null
        playbackNodeRef.current?.disconnect()
        playbackNodeRef.current = null

        captureCtxRef.current?.close().catch(() => {})
        captureCtxRef.current = null
        playbackCtxRef.current?.close().catch(() => {})
        playbackCtxRef.current = null
    }, [])

    const stop = useCallback(() => {
        socketRef.current?.emit(ClientEvent.Stop)
        socketRef.current?.disconnect()
        socketRef.current = null
        releaseAudio()
        setConnected(false)
        setActivity(null)
        setLevel(0)
        setState('idle')
    }, [releaseAudio])

    // Unmount is the one path that must never leak a live microphone.
    useEffect(() => () => {
        socketRef.current?.disconnect()
        socketRef.current = null
        releaseAudio()
    }, [releaseAudio])

    // ── Transcript assembly ─────────────────────────────────────────────────

    const appendTranscript = useCallback((payload: TranscriptPayload) => {
        setTranscript((prev) => {
            const next = [...prev]

            // Interim user text is a single replaceable line — the provider resends the
            // whole guess each time, so appending would stutter the words.
            if (payload.role === 'user' && !payload.final) {
                const index = next.findIndex((e) => e.id === 'interim-user')
                const entry: TranscriptEntry = {
                    id: 'interim-user',
                    role: 'user',
                    text: payload.text,
                    final: false,
                    turnId: payload.turnId,
                }
                if (index >= 0) next[index] = entry
                else next.push(entry)
                return next
            }

            if (payload.role === 'user' && payload.final) {
                const index = next.findIndex((e) => e.id === 'interim-user')
                if (index >= 0) next.splice(index, 1)
                next.push({
                    id: `user-${payload.turnId}-${next.length}`,
                    role: 'user',
                    text: payload.text,
                    final: true,
                    turnId: payload.turnId,
                })
                return next
            }

            // Assistant transcription streams in fragments that must be concatenated into
            // the one bubble for this turn.
            const openIndex = next.findIndex(
                (e) => e.role === 'assistant' && e.turnId === payload.turnId && !e.final,
            )
            if (openIndex >= 0) {
                next[openIndex] = {
                    ...next[openIndex],
                    text: next[openIndex].text + payload.text,
                }
                return next
            }

            next.push({
                id: `assistant-${payload.turnId}`,
                role: 'assistant',
                text: payload.text,
                final: false,
                turnId: payload.turnId,
            })
            return next
        })
    }, [])

    // ── Audio graph ─────────────────────────────────────────────────────────

    const startPlayback = useCallback(async () => {
        // Explicit 24 kHz so the provider's PCM plays at its native rate without us
        // resampling it.
        const ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })
        await ctx.audioWorklet.addModule('/voice/playback-processor.js')
        const node = new AudioWorkletNode(ctx, 'voice-playback', { numberOfInputs: 0 })

        node.port.onmessage = (event) => {
            // Playback finished draining. The provider's turnComplete fires while audio is
            // still queued, so this is the honest end of "speaking".
            if (event.data?.type === 'drained') {
                setState((current) => (current === 'speaking' ? 'listening' : current))
            }
        }

        node.connect(ctx.destination)
        playbackCtxRef.current = ctx
        playbackNodeRef.current = node
    }, [])

    const startCapture = useCallback(async (socket: Socket) => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        })
        streamRef.current = stream

        // Explicit 16 kHz: the browser resamples from whatever the hardware runs at, which
        // is both cheaper and better than doing it ourselves.
        const ctx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE })
        await ctx.audioWorklet.addModule('/voice/capture-processor.js')

        const source = ctx.createMediaStreamSource(stream)
        const node = new AudioWorkletNode(ctx, 'voice-capture', {
            numberOfOutputs: 0,
            processorOptions: { frameSamples: CAPTURE_FRAME_SAMPLES },
        })

        node.port.onmessage = (event) => {
            const data = event.data
            if (!data || data.type !== 'frame') return

            socket.emit(ClientEvent.Audio, data.pcm)

            const now = performance.now()
            if (now - lastLevelPushRef.current > 80) {
                lastLevelPushRef.current = now
                setLevel(Math.min(1, (data.peak ?? 0) * 1.6))
            }
        }

        source.connect(node)
        captureCtxRef.current = ctx
        captureNodeRef.current = node
    }, [])

    // ── Start ───────────────────────────────────────────────────────────────

    const start = useCallback(async () => {
        if (socketRef.current) return

        setError(null)
        setState('connecting')
        setTranscript([])
        currentTurnRef.current = 1

        // `path` must match the Socket.IO server mounted in server.js; the namespace is
        // the second argument, not part of the path.
        const socket = io(VOICE_NAMESPACE, {
            path: '/api/socket',
            transports: ['websocket'],
            withCredentials: true,
            reconnectionAttempts: 3,
        })
        socketRef.current = socket

        socket.on('connect', () => {
            setConnected(true)
            socket.emit(ClientEvent.Start, { language })
        })

        socket.on('connect_error', (err) => {
            // The gateway rejects the handshake with a human-readable reason — a missing
            // session, or a consultation already holding the microphone.
            const message = err?.message || 'Could not connect'
            const consultation = /consultation/i.test(message)
            setError({
                code: consultation ? 'consultation_active' : 'unauthorized',
                message: consultation
                    ? 'You are in a video consultation right now. The assistant cannot use ' +
                      'your microphone at the same time.'
                    : message,
                recoverable: false,
            })
            setState('error')
            releaseAudio()
        })

        socket.on('disconnect', () => {
            setConnected(false)
            setState((current) => (current === 'error' ? current : 'idle'))
        })

        socket.on(ServerEvent.Ready, async (payload: ReadyPayload) => {
            setLanguage(payload.language)
            try {
                // Playback first: if the mic is refused we still want to hear the reply to
                // a typed question, so a denied microphone degrades to text rather than
                // disabling the assistant.
                if (!playbackCtxRef.current) await startPlayback()
                if (!captureCtxRef.current) await startCapture(socket)
                setState('listening')
            } catch (err) {
                setError(micError(err))
                setState('listening')
            }
        })

        socket.on(ServerEvent.State, ({ state: next }: { state: VoiceState }) => {
            setState(next)
            if (next !== 'thinking') setActivity(null)
        })

        socket.on(ServerEvent.Audio, (frame: ArrayBuffer) => {
            const { turnId, pcm } = decodeAudioFrame(frame)
            // Stale audio from an interrupted turn. Dropped before conversion so an
            // interrupted sentence cannot resume over the user.
            if (turnId < currentTurnRef.current) return

            const node = playbackNodeRef.current
            if (!node) return

            const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 2)
            const floats = new Float32Array(samples.length)
            for (let i = 0; i < samples.length; i++) floats[i] = samples[i] / 0x8000

            node.port.postMessage({ type: 'push', pcm: floats.buffer }, [floats.buffer])
        })

        socket.on(ServerEvent.Transcript, appendTranscript)

        socket.on(ServerEvent.Interrupted, ({ turnId }: InterruptedPayload) => {
            currentTurnRef.current = turnId + 1
            // Flush inside the worklet: anything already queued stops on the next render
            // quantum rather than finishing its chunk.
            playbackNodeRef.current?.port.postMessage({ type: 'flush' })
            setActivity(null)
            setTranscript((prev) =>
                prev.map((e) =>
                    e.turnId <= turnId && !e.final ? { ...e, final: true } : e,
                ),
            )
        })

        socket.on(ServerEvent.TurnComplete, ({ turnId }: TurnCompletePayload) => {
            currentTurnRef.current = Math.max(currentTurnRef.current, turnId + 1)
            setTranscript((prev) =>
                prev.map((e) => (e.turnId === turnId ? { ...e, final: true } : e)),
            )
        })

        socket.on(ServerEvent.Tool, (payload: ToolPayload & { clientAction?: unknown }) => {
            setActivity(payload.status === 'running' ? payload.label : null)

            const action = payload.clientAction as
                | { kind: 'navigate'; path: string }
                | undefined
            // Guided navigation: the agent says what it is opening, then this moves them.
            // Paths come from a fixed allow-list in the tool executor, never from the model.
            if (action?.kind === 'navigate' && action.path.startsWith('/')) {
                router.push(action.path)
            }
        })

        socket.on(ServerEvent.Reconnecting, (payload: ReconnectingPayload) => {
            setState('reconnecting')
            setActivity(null)
            void payload
        })

        socket.on(ServerEvent.Error, (payload: ErrorPayload) => {
            setError(payload)
            setState(payload.recoverable ? 'listening' : 'error')
            if (!payload.recoverable) releaseAudio()
        })
    }, [appendTranscript, language, releaseAudio, router, startCapture, startPlayback])

    // ── Controls ────────────────────────────────────────────────────────────

    const interrupt = useCallback(() => {
        playbackNodeRef.current?.port.postMessage({ type: 'flush' })
        socketRef.current?.emit(ClientEvent.Interrupt)
    }, [])

    const sendText = useCallback((text: string) => {
        const trimmed = text.trim()
        if (!trimmed || !socketRef.current) return
        // Typing is treated as a barge-in: if the assistant is mid-sentence, the user has
        // moved on.
        playbackNodeRef.current?.port.postMessage({ type: 'flush' })
        socketRef.current.emit(ClientEvent.Text, { text: trimmed })
        setState('thinking')
    }, [])

    const setMuted = useCallback((value: boolean) => {
        setMutedState(value)
        captureNodeRef.current?.port.postMessage({ type: 'mute', value })
        // Telling the provider the stream ended lets it close the turn instead of waiting
        // out its silence timer.
        if (value) socketRef.current?.emit(ClientEvent.AudioEnd)
        if (value) setLevel(0)
    }, [])

    const changeLanguage = useCallback((next: LanguageCode) => {
        setLanguage(next)
        setTranscript([])
        // The provider fixes language at setup, so the gateway reopens the session.
        if (socketRef.current) socketRef.current.emit(ClientEvent.Language, { language: next })
    }, [])

    return useMemo(
        () => ({
            state,
            transcript,
            error,
            activity,
            level,
            muted,
            language,
            connected,
            start,
            stop,
            interrupt,
            sendText,
            setMuted,
            changeLanguage,
        }),
        [
            state,
            transcript,
            error,
            activity,
            level,
            muted,
            language,
            connected,
            start,
            stop,
            interrupt,
            sendText,
            setMuted,
            changeLanguage,
        ],
    )
}
