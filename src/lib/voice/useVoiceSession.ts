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
    type UiPayload,
    type PendingPayload,
    type VoiceErrorCode,
    type VoiceState,
} from './protocol'
import {
    CAPTURE_FRAME_SAMPLES,
    DEFAULT_LANGUAGE,
    INPUT_SAMPLE_RATE,
    OUTPUT_SAMPLE_RATE,
    SUPPORTED_LANGUAGES,
    detectScript,
    type LanguageCode,
} from './config'
import { createTranslator, errorMessage, toolLabel, type Translator } from './i18n'

export type TranscriptEntry = {
    id: string
    role: 'user' | 'assistant'
    text: string
    final: boolean
    turnId: number
}

export type VoiceSessionError = ErrorPayload | null

/**
 * A language the patient appears to be speaking that is not the one selected.
 *
 * Offered rather than applied. Script can identify a writing system reliably but cannot
 * separate languages that share one — Hindi and Marathi are both Devanagari — so silently
 * switching would sometimes be wrong in a way the patient cannot undo mid-sentence.
 */
export type LanguageSuggestion = { code: LanguageCode; label: string } | null

/** Browser location permission as far as this session is concerned. */
export type LocationState = 'unknown' | 'requesting' | 'granted' | 'denied' | 'unavailable'

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
    /** Localized string lookup for the current language. */
    t: Translator
    /** Renderable tool results, most recent last. */
    cards: UiPayload[]
    /** Non-null with `state: 'awaiting'` while a confirmation card should show. */
    pending: PendingPayload | null
    locationState: LocationState
    /** Confirm or reject the pending action from the card. */
    decide: (approved: boolean) => void
    /** Asks the browser for location, then sends it. Needs a user gesture. */
    requestLocation: () => void
    suggestion: LanguageSuggestion
    acceptSuggestion: () => void
    dismissSuggestion: () => void
    /** True while a language change is reopening the provider session. */
    switchingLanguage: boolean
    start: () => Promise<void>
    stop: () => void
    interrupt: () => void
    sendText: (text: string) => void
    setMuted: (value: boolean) => void
    changeLanguage: (language: LanguageCode) => void
}

/**
 * `getUserMedia` rejection names → our error codes.
 *
 * Only the code is decided here; the wording comes from the message catalog so the
 * guidance appears in the patient's own language. An English-only error under a Tamil
 * conversation is the inconsistency Phase 3 is meant to remove.
 */
function micErrorCode(error: unknown): VoiceErrorCode {
    const name = (error as { name?: string })?.name ?? ''
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'mic_denied'
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'mic_unavailable'
    if (name === 'NotReadableError' || name === 'AbortError') return 'mic_in_use'
    return 'internal'
}

/** The browser's own zone, or null when the environment will not say. */
function browserTimeZone(): string | undefined {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
    } catch {
        return undefined
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
    const [suggestion, setSuggestion] = useState<LanguageSuggestion>(null)
    const [switchingLanguage, setSwitchingLanguage] = useState(false)
    const [cards, setCards] = useState<UiPayload[]>([])
    const [pending, setPending] = useState<PendingPayload | null>(null)
    const [locationState, setLocationState] = useState<LocationState>('unknown')

    const t = useMemo(() => createTranslator(language), [language])
    /** Suggestions the patient has waved away, so they are not asked twice. */
    const dismissedRef = useRef<Set<string>>(new Set())

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

    /**
     * Mirrors `language` for use inside socket handlers.
     *
     * The handlers are registered once in `start` and would otherwise close over the
     * language as it was at that moment, so every later comparison would be against a
     * stale value — and the detection hint would fire against the wrong baseline.
     */
    const languageRef = useRef<LanguageCode>(DEFAULT_LANGUAGE)
    useEffect(() => {
        languageRef.current = language
    }, [language])

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

    /**
     * Proposes a language when the patient is clearly writing in another script.
     *
     * Only fires on final user transcripts of reasonable length — an interim guess at two
     * syllables is not evidence — and never for a script the current language already
     * uses, which is what keeps a Hindi speaker from being asked about Marathi.
     */
    const considerLanguage = useCallback((text: string) => {
        if (text.trim().length < 8) return

        const current = SUPPORTED_LANGUAGES.find((l) => l.code === languageRef.current)
        const script = detectScript(text)
        if (!script || !current || script === current.script) return

        const candidate = SUPPORTED_LANGUAGES.find(
            (l) => l.script === script && l.code !== 'en-US',
        )
        if (!candidate || candidate.code === languageRef.current) return
        if (dismissedRef.current.has(candidate.code)) return

        setSuggestion({ code: candidate.code, label: candidate.label })
    }, [])

    const appendTranscript = useCallback((payload: TranscriptPayload) => {
        if (payload.role === 'user' && payload.final) considerLanguage(payload.text)

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
    }, [considerLanguage])

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
        setCards([])
        setPending(null)
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
            socket.emit(ClientEvent.Start, { language, timeZone: browserTimeZone() })
        })

        socket.on('connect_error', (err) => {
            /**
             * Only treat this as an auth problem when the gateway actually said so.
             *
             * `connect_error` covers everything that can stop a socket opening: the
             * handshake being rejected, but equally a proxy refusing the WebSocket
             * upgrade, a CDN in front of the app, a timeout, or the custom server not
             * running the gateway at all. This used to map anything that did not mention
             * "consultation" to `unauthorized`, so every one of those infrastructure
             * failures told a signed-in patient to sign in again — advice that cannot
             * work, and that points whoever is debugging at entirely the wrong layer.
             *
             * The gateway's own rejection messages are known strings (see
             * `attachVoiceGateway`), so match those and treat everything else as "the
             * service could not be reached", which is both true and actionable.
             */
            const message = err?.message || ''
            const code: VoiceErrorCode = /consultation/i.test(message)
                ? 'consultation_active'
                : /sign in|verify your session/i.test(message)
                  ? 'unauthorized'
                  : 'provider_unavailable'

            // The raw reason never reaches the panel — it is transport jargon — but it is
            // the single most useful line when diagnosing a deployment, so it goes to the
            // console verbatim.
            console.error(`[voice] connection failed: ${message || '(no reason given)'}`)

            setError({
                code,
                message: errorMessage(createTranslator(languageRef.current), code),
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
            setSwitchingLanguage(false)
            try {
                // Playback first: if the mic is refused we still want to hear the reply to
                // a typed question, so a denied microphone degrades to text rather than
                // disabling the assistant.
                if (!playbackCtxRef.current) await startPlayback()
                if (!captureCtxRef.current) await startCapture(socket)
                setState('listening')
            } catch (err) {
                const code = micErrorCode(err)
                setError({
                    code,
                    // Wording comes from the catalog, so the guidance is in the language
                    // the patient is actually speaking.
                    message: errorMessage(createTranslator(payload.language), code),
                    recoverable: true,
                })
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
            // The gateway's `label` is English; it is useful in server logs but must not
            // reach the panel untranslated, so the label is resolved from the tool name
            // against the current catalog instead.
            setActivity(
                payload.status === 'running'
                    ? toolLabel(createTranslator(languageRef.current), payload.name)
                    : null,
            )

            const action = payload.clientAction as
                | { kind: 'navigate'; path: string }
                | undefined
            // Guided navigation: the agent says what it is opening, then this moves them.
            // Paths come from a fixed allow-list in the tool executor, never from the model.
            if (action?.kind === 'navigate' && action.path.startsWith('/')) {
                router.push(action.path)
            }
        })

        socket.on(ServerEvent.Ui, (payload: UiPayload) => {
            // Capped: a long conversation would otherwise accumulate every card it ever
            // rendered, and the panel is a small scroll area.
            setCards((prev) => [...prev, payload].slice(-6))
        })

        socket.on(ServerEvent.Pending, (payload: PendingPayload) => {
            setPending(payload.state === 'awaiting' ? payload : null)
            // Once resolved, the confirmation card is stale and must not linger — leaving
            // a Confirm button on screen after the action completed invites a second press.
            if (payload.state !== 'awaiting') {
                setCards((prev) => prev.filter((c) => c.kind !== 'confirm'))
            }
        })

        socket.on(ServerEvent.Reconnecting, (payload: ReconnectingPayload) => {
            setState('reconnecting')
            setActivity(null)
            void payload
        })

        socket.on(ServerEvent.Error, (payload: ErrorPayload) => {
            // The gateway sends a code and an English message; the code is what we trust,
            // so the text shown matches the conversation's language.
            setError({
                ...payload,
                message: errorMessage(createTranslator(languageRef.current), payload.code),
            })
            setState(payload.recoverable ? 'listening' : 'error')
            setSwitchingLanguage(false)
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
        setSuggestion(null)
        // The transcript is deliberately NOT cleared. The provider fixes language at setup
        // so the gateway must reopen the session, but it replays the conversation into the
        // new one — losing the visible history would make a mid-task switch feel like
        // starting over, which is the thing this is supposed to avoid.
        if (socketRef.current) {
            setSwitchingLanguage(true)
            socketRef.current.emit(ClientEvent.Language, { language: next })
        }
    }, [])

    const decide = useCallback((approved: boolean) => {
        socketRef.current?.emit(ClientEvent.Decide, { approved })
        setPending(null)
        setCards((prev) => prev.filter((c) => c.kind !== 'confirm'))
    }, [])

    /**
     * Requests browser location and forwards it.
     *
     * Deliberately only ever called from a button press. `navigator.geolocation` needs a
     * user gesture, and asking for someone's location the moment they open a voice panel
     * — before they have mentioned a pharmacy — is a permission prompt they have no
     * context for and will reasonably refuse.
     */
    const requestLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationState('unavailable')
            return
        }
        setLocationState('requesting')
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocationState('granted')
                socketRef.current?.emit(ClientEvent.Location, {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                })
                setCards((prev) => prev.filter((c) => c.kind !== 'location_consent'))
                // Nudge the model to retry now that a position exists, rather than leaving
                // the patient to repeat themselves.
                socketRef.current?.emit(ClientEvent.Text, {
                    text: '[Location access granted. Search for nearby pharmacies now.]',
                })
            },
            () => setLocationState('denied'),
            { timeout: 10_000, maximumAge: 5 * 60 * 1000 },
        )
    }, [])

    const acceptSuggestion = useCallback(() => {
        if (suggestion) changeLanguage(suggestion.code)
    }, [suggestion, changeLanguage])

    const dismissSuggestion = useCallback(() => {
        if (suggestion) dismissedRef.current.add(suggestion.code)
        setSuggestion(null)
    }, [suggestion])

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
            t,
            cards,
            pending,
            locationState,
            decide,
            requestLocation,
            suggestion,
            acceptSuggestion,
            dismissSuggestion,
            switchingLanguage,
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
            t,
            cards,
            pending,
            locationState,
            decide,
            requestLocation,
            suggestion,
            acceptSuggestion,
            dismissSuggestion,
            switchingLanguage,
            start,
            stop,
            interrupt,
            sendText,
            setMuted,
            changeLanguage,
        ],
    )
}
