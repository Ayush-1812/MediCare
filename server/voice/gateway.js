/**
 * Voice receptionist gateway: bridges a browser socket to a Gemini Live session.
 *
 * Why it lives here and not in a Next route handler: a Next route cannot perform a
 * WebSocket upgrade, and duplex audio needs one. `server.js` already runs Socket.IO for
 * WebRTC signaling, so the voice channel takes its own namespace on the same server and
 * adds no infrastructure.
 *
 * What this file deliberately does NOT do is touch the database or reimplement any
 * business logic. When the model calls a tool, the call is forwarded into Next — with the
 * patient's own cookie — so the real server actions run under the real session. The
 * gateway only moves audio and manages the lifecycle of one provider session.
 *
 * The long-lived `GEMINI_API_KEY` never leaves this process. The browser authenticates to
 * us with the httpOnly cookie it already holds, so no ephemeral provider token is needed
 * for this topology.
 *
 * Event names and the audio frame layout mirror `src/lib/voice/protocol.ts` — keep them
 * in step, following the same convention `server.js` uses for `src/lib/auth.ts`.
 */

const { GoogleGenAI } = require('@google/genai')
const { parseCookies, sessionId, USER_COOKIE } = require('../lib/session')

const VOICE_NAMESPACE = '/voice'

const ClientEvent = {
    Start: 'voice:start',
    Audio: 'voice:audio',
    AudioEnd: 'voice:audio-end',
    Text: 'voice:text',
    Interrupt: 'voice:interrupt',
    Language: 'voice:language',
    Stop: 'voice:stop',
}

const ServerEvent = {
    Ready: 'voice:ready',
    State: 'voice:state',
    Audio: 'voice:audio',
    Transcript: 'voice:transcript',
    Interrupted: 'voice:interrupted',
    Tool: 'voice:tool',
    TurnComplete: 'voice:turn-complete',
    Reconnecting: 'voice:reconnecting',
    Error: 'voice:error',
}

const AUDIO_HEADER_BYTES = 8
const INPUT_MIME_TYPE = 'audio/pcm;rate=16000'
const TOOL_FETCH_TIMEOUT_MS = 12_000
const SESSION_MAX_MS = 30 * 60 * 1000
const MAX_RECONNECT_ATTEMPTS = 3

/** `[turnId: uint32 LE][seq: uint32 LE][pcm...]` — see protocol.ts. */
function encodeAudioFrame(turnId, seq, pcm) {
    const out = Buffer.allocUnsafe(AUDIO_HEADER_BYTES + pcm.length)
    out.writeUInt32LE(turnId >>> 0, 0)
    out.writeUInt32LE(seq >>> 0, 4)
    pcm.copy(out, AUDIO_HEADER_BYTES)
    return out
}

/**
 * Classifies a provider failure into a code the UI can act on, mirroring the
 * classification `GeminiService` already does for the text path.
 */
function classifyProviderError(error) {
    const status = error && (error.status || error.statusCode)
    const message = String((error && error.message) || '')
    if (status === 429 || /quota|rate limit/i.test(message)) return 'provider_quota'
    if (status === 401 || status === 403) return 'provider_unavailable'
    if (status && status >= 500) return 'provider_unavailable'
    if (/closed|socket|network|econnreset|etimedout/i.test(message)) return 'network'
    return 'internal'
}

/** One browser socket's voice session. */
class VoiceSession {
    constructor(socket, deps) {
        this.socket = socket
        this.ai = deps.ai
        this.baseUrl = deps.baseUrl
        this.internalSecret = deps.internalSecret
        this.userId = socket.data.userId
        this.cookieHeader = socket.handshake.headers.cookie || ''

        this.live = null
        this.language = null
        this.liveConfig = null
        this.model = null

        /**
         * Monotonic turn counter. Every assistant-produced message carries it, and it is
         * bumped the instant a turn ends or is interrupted. Anything that arrives tagged
         * with an older value — late audio, a tool result for an abandoned turn — is
         * dropped rather than delivered.
         */
        this.turnId = 1
        this.audioSeq = 0

        /** Tool calls still in flight, by provider call id, so they can be cancelled. */
        this.pendingTools = new Map()

        /**
         * Results of completed mutating tool calls, keyed by idempotency key. A session
         * that reconnects must not re-run a booking it already completed; replaying the
         * recorded result instead is what makes reconnection safe. Phase 2 registers no
         * mutating tools, so this stays empty — the path exists so that adding one is a
         * one-line change in definitions.ts rather than a redesign here.
         */
        this.completedMutations = new Map()

        this.resumeHandle = null
        this.reconnectAttempts = 0
        this.closed = false
        this.state = 'connecting'

        this.expiryTimer = setTimeout(() => {
            this.fail('session_expired', 'This voice session reached its time limit.', false)
        }, SESSION_MAX_MS)
    }

    // ── Outbound helpers ────────────────────────────────────────────────────

    setState(state) {
        if (this.closed || this.state === state) return
        this.state = state
        this.socket.emit(ServerEvent.State, { state })
    }

    fail(code, message, recoverable) {
        if (this.closed) return
        this.socket.emit(ServerEvent.Error, { code, message, recoverable })
        if (!recoverable) this.dispose()
        else this.setState('error')
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────

    /** Fetches this session's config from Next, then opens the provider connection. */
    async start(language) {
        const bootstrap = await this.fetchJson('/api/voice/session', { language })
        if (!bootstrap || !bootstrap.ok) {
            const status = bootstrap && bootstrap.__status
            if (status === 401) {
                return this.fail('unauthorized', 'Please sign in again to use the voice assistant.', false)
            }
            return this.fail('internal', 'Could not start the voice assistant.', false)
        }

        this.language = bootstrap.language
        this.model = bootstrap.model
        this.liveConfig = bootstrap.config
        await this.connectLive({ resumed: false })
    }

    /**
     * Opens (or reopens) the Live connection.
     *
     * `includeVoice: false` on the retry path drops `speechConfig.voiceConfig`: prebuilt
     * voice names are a fixed Google-side set, and an unrecognised one fails `setup`
     * outright. Falling back to the model's default voice beats handing the user a dead
     * session over a cosmetic setting.
     */
    async connectLive({ resumed, dropVoice = false }) {
        const config = { ...this.liveConfig }

        if (dropVoice && config.speechConfig) {
            const { voiceConfig, ...rest } = config.speechConfig
            config.speechConfig = rest
        }

        // A stored handle resumes the provider-side conversation after a drop, so context
        // survives a reconnect instead of the patient having to start over.
        config.sessionResumption = this.resumeHandle ? { handle: this.resumeHandle } : {}

        try {
            this.live = await this.ai.live.connect({
                model: this.model,
                config,
                callbacks: {
                    onopen: () => {},
                    onmessage: (message) => {
                        // Never let a handler throw into the SDK's socket callback: it
                        // would take the connection down with no diagnostic.
                        try {
                            this.onProviderMessage(message)
                        } catch (error) {
                            console.error('[voice] message handler threw:', error)
                        }
                    },
                    onerror: (event) => {
                        const error = (event && (event.error || event.message)) || event
                        console.error('[voice] provider error:', error)
                        this.handleDrop('provider_error', error)
                    },
                    onclose: () => {
                        if (!this.closed) this.handleDrop('provider_error', new Error('closed'))
                    },
                },
            })
        } catch (error) {
            console.error('[voice] live.connect failed:', error)

            // One targeted retry for a rejected voice name, then give up honestly.
            if (!dropVoice && /voice/i.test(String((error && error.message) || ''))) {
                console.warn('[voice] retrying without prebuilt voice name')
                return this.connectLive({ resumed, dropVoice: true })
            }

            const code = classifyProviderError(error)
            return this.fail(
                code,
                code === 'provider_quota'
                    ? 'The voice service is over its quota right now. Please try again later.'
                    : 'Could not reach the voice service.',
                false,
            )
        }

        this.reconnectAttempts = 0
        if (this.closed) return this.live.close()

        this.socket.emit(ServerEvent.Ready, {
            sessionId: this.socket.id,
            language: this.language,
            model: this.model,
            resumed: Boolean(resumed),
        })
        this.setState('listening')
    }

    /** Provider connection lost. Resume if we can, and say so while it happens. */
    async handleDrop(reason, error, timeLeftMs) {
        if (this.closed) return
        this.live = null

        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            const code = classifyProviderError(error || {})
            return this.fail(code, 'The voice connection was lost. Please start again.', false)
        }

        this.reconnectAttempts += 1
        this.setState('reconnecting')
        this.socket.emit(ServerEvent.Reconnecting, { reason, timeLeftMs })

        // A turn was almost certainly in progress; invalidate it so no stale audio or
        // tool result from before the drop is applied afterwards.
        this.cancelCurrentTurn()

        const backoffMs = 400 * this.reconnectAttempts
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
        if (this.closed) return
        await this.connectLive({ resumed: true })
    }

    dispose() {
        if (this.closed) return
        this.closed = true
        clearTimeout(this.expiryTimer)
        for (const pending of this.pendingTools.values()) pending.cancelled = true
        this.pendingTools.clear()
        try {
            if (this.live) this.live.close()
        } catch {
            /* already gone */
        }
        this.live = null
    }

    // ── Turn bookkeeping ────────────────────────────────────────────────────

    /**
     * Ends the current turn and invalidates everything belonging to it.
     *
     * This is the single mechanism behind interruption safety. Bumping `turnId` means any
     * audio chunk still arriving from the provider, and any tool result still resolving,
     * is recognised as stale and discarded instead of being played over the user or fed
     * back into an abandoned turn.
     */
    cancelCurrentTurn() {
        const interrupted = this.turnId
        for (const [id, pending] of this.pendingTools) {
            if (pending.turnId <= interrupted) {
                pending.cancelled = true
                this.socket.emit(ServerEvent.Tool, {
                    name: pending.name,
                    status: 'cancelled',
                    label: pending.label,
                    turnId: pending.turnId,
                })
                this.pendingTools.delete(id)
            }
        }
        this.turnId += 1
        this.audioSeq = 0
        return interrupted
    }

    // ── Provider → client ───────────────────────────────────────────────────

    onProviderMessage(message) {
        if (this.closed) return

        if (message.setupComplete) this.setState('listening')

        if (message.sessionResumptionUpdate) {
            const update = message.sessionResumptionUpdate
            // Only a handle flagged resumable is worth keeping; storing a partial one
            // would make the next reconnect fail in a way that looks like a drop.
            if (update.resumable && update.newHandle) this.resumeHandle = update.newHandle
        }

        if (message.goAway) {
            const timeLeft = message.goAway.timeLeft
            // The provider is warning us before it closes. Reconnecting now, while the
            // handle is fresh, turns a hard failure into an inaudible blip.
            this.handleDrop('provider_goaway', null, parseDurationMs(timeLeft))
            return
        }

        const content = message.serverContent
        if (content) this.onServerContent(content)

        if (message.toolCallCancellation) {
            const ids = message.toolCallCancellation.ids || []
            for (const id of ids) {
                const pending = this.pendingTools.get(id)
                if (!pending) continue
                pending.cancelled = true
                this.pendingTools.delete(id)
                this.socket.emit(ServerEvent.Tool, {
                    name: pending.name,
                    status: 'cancelled',
                    label: pending.label,
                    turnId: pending.turnId,
                })
            }
        }

        if (message.toolCall) {
            const calls = message.toolCall.functionCalls || []
            if (calls.length > 0) this.runToolCalls(calls)
        }
    }

    onServerContent(content) {
        // Barge-in. Flush first and ask questions later: the user is already talking over
        // the assistant, so every millisecond of queued audio is a millisecond of them
        // being spoken over.
        if (content.interrupted) {
            const interruptedTurn = this.cancelCurrentTurn()
            this.socket.emit(ServerEvent.Interrupted, { turnId: interruptedTurn })
            this.setState('listening')
            return
        }

        if (content.inputTranscription && content.inputTranscription.text) {
            this.socket.emit(ServerEvent.Transcript, {
                role: 'user',
                text: content.inputTranscription.text,
                final: true,
                turnId: this.turnId,
            })
        }

        if (content.interimInputTranscription && content.interimInputTranscription.text) {
            this.socket.emit(ServerEvent.Transcript, {
                role: 'user',
                text: content.interimInputTranscription.text,
                final: false,
                turnId: this.turnId,
            })
        }

        if (content.outputTranscription && content.outputTranscription.text) {
            this.socket.emit(ServerEvent.Transcript, {
                role: 'assistant',
                text: content.outputTranscription.text,
                final: false,
                turnId: this.turnId,
            })
        }

        const parts = (content.modelTurn && content.modelTurn.parts) || []
        for (const part of parts) {
            const inline = part.inlineData
            if (!inline || !inline.data) continue
            // Native-audio output is base64 PCM16 @24 kHz. Decoded here so the socket
            // carries raw bytes rather than paying base64's overhead on the hot path.
            const pcm = Buffer.from(inline.data, 'base64')
            if (pcm.length === 0) continue
            if (this.state !== 'speaking') this.setState('speaking')
            this.socket.emit(
                ServerEvent.Audio,
                encodeAudioFrame(this.turnId, this.audioSeq++, pcm),
            )
        }

        if (content.turnComplete || content.generationComplete) {
            const finished = this.turnId
            this.socket.emit(ServerEvent.TurnComplete, { turnId: finished })
            this.turnId += 1
            this.audioSeq = 0
            this.setState('listening')
        }
    }

    // ── Tool calls ──────────────────────────────────────────────────────────

    runToolCalls(calls) {
        this.setState('thinking')
        for (const call of calls) this.runToolCall(call)
    }

    async runToolCall(call) {
        const id = call.id
        const name = call.name
        const args = call.args || {}
        const turnId = this.turnId
        const label = toolLabel(name)

        const pending = { name, label, turnId, cancelled: false }
        if (id) this.pendingTools.set(id, pending)

        this.socket.emit(ServerEvent.Tool, { name, status: 'running', label, turnId })

        const response = await this.fetchJson('/api/voice/tool', { name, args })

        // Three ways this result can be void by the time it lands: the provider cancelled
        // the call, the user interrupted (bumping turnId), or the session ended. In all
        // three the result must be discarded rather than sent — feeding it back would have
        // the assistant answer a question nobody is waiting on any more.
        if (this.closed || pending.cancelled || turnId !== this.turnId) {
            if (id) this.pendingTools.delete(id)
            return
        }
        if (id) this.pendingTools.delete(id)

        const ok = Boolean(response && response.ok)
        this.socket.emit(ServerEvent.Tool, {
            name,
            status: ok ? 'done' : 'error',
            label,
            turnId,
        })

        // A client-side effect (currently only navigation) rides back on the same event
        // stream, so the page moves as the assistant says it is moving.
        if (ok && response.clientAction) {
            this.socket.emit(ServerEvent.Tool, {
                name,
                status: 'done',
                label,
                turnId,
                clientAction: response.clientAction,
            })
        }

        if (!this.live) return
        try {
            this.live.sendToolResponse({
                functionResponses: [
                    {
                        ...(id ? { id } : {}),
                        name,
                        // The model is given the tool's own payload, errors included —
                        // it has explicit instructions to narrate a failure rather than
                        // paper over it.
                        response: response && response.data !== undefined
                            ? { result: response.data }
                            : { error: 'Tool produced no result.' },
                    },
                ],
            })
        } catch (error) {
            console.error('[voice] sendToolResponse failed:', error)
        }
    }

    /**
     * Calls into Next, forwarding the patient's cookie so the server actions behind the
     * endpoint run under their real session, plus the process-local secret that proves
     * the call came from the gateway.
     */
    async fetchJson(path, body) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), TOOL_FETCH_TIMEOUT_MS)
        try {
            const res = await fetch(`${this.baseUrl}${path}`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    cookie: this.cookieHeader,
                    'x-voice-internal': this.internalSecret,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            })
            const json = await res.json().catch(() => null)
            if (json && typeof json === 'object') json.__status = res.status
            return json
        } catch (error) {
            console.error(`[voice] internal call ${path} failed:`, error.message)
            return null
        } finally {
            clearTimeout(timer)
        }
    }

    // ── Client → provider ───────────────────────────────────────────────────

    pushAudio(chunk) {
        if (!this.live || this.closed) return
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        if (buffer.length === 0) return
        try {
            this.live.sendRealtimeInput({
                audio: { data: buffer.toString('base64'), mimeType: INPUT_MIME_TYPE },
            })
        } catch (error) {
            console.error('[voice] sendRealtimeInput failed:', error)
            this.handleDrop('provider_error', error)
        }
    }

    endAudio() {
        if (!this.live || this.closed) return
        try {
            this.live.sendRealtimeInput({ audioStreamEnd: true })
        } catch {
            /* the stream is already gone */
        }
    }

    sendText(text) {
        if (!this.live || this.closed) return
        const trimmed = String(text || '').trim()
        if (!trimmed) return
        // Typed input is a first-class path, not a fallback bolted on: same session, same
        // tools, same spoken reply. It is also the accessibility route for anyone who
        // cannot or will not use a microphone.
        this.socket.emit(ServerEvent.Transcript, {
            role: 'user',
            text: trimmed,
            final: true,
            turnId: this.turnId,
        })
        try {
            this.live.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: trimmed }] }],
                turnComplete: true,
            })
            this.setState('thinking')
        } catch (error) {
            console.error('[voice] sendClientContent failed:', error)
            this.handleDrop('provider_error', error)
        }
    }

    /** Manual stop button: end this turn without tearing down the session. */
    interrupt() {
        if (this.closed) return
        const interrupted = this.cancelCurrentTurn()
        this.socket.emit(ServerEvent.Interrupted, { turnId: interrupted })
        this.setState('listening')
        if (!this.live) return
        try {
            // Telling the provider the user's activity started is what makes it abandon
            // its own in-progress generation, matching a real barge-in.
            this.live.sendRealtimeInput({ activityStart: {} })
            this.live.sendRealtimeInput({ activityEnd: {} })
        } catch {
            /* best effort */
        }
    }

    /** Language changes need a new provider session: it is fixed at setup time. */
    async changeLanguage(language) {
        if (this.closed) return
        this.cancelCurrentTurn()
        try {
            if (this.live) this.live.close()
        } catch {
            /* ignore */
        }
        this.live = null
        this.resumeHandle = null
        this.setState('connecting')
        await this.start(language)
    }
}

/** `"4s"` / `{ seconds: 4 }` / `4000` → milliseconds, or undefined. */
function parseDurationMs(value) {
    if (value == null) return undefined
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        const match = /^([\d.]+)s$/.exec(value.trim())
        if (match) return Math.round(Number(match[1]) * 1000)
        const asNumber = Number(value)
        return Number.isFinite(asNumber) ? asNumber : undefined
    }
    if (typeof value === 'object' && value.seconds != null) {
        return Math.round(Number(value.seconds) * 1000)
    }
    return undefined
}

const TOOL_LABELS = {
    get_my_profile: 'Looking up your profile',
    list_my_appointments: 'Checking your appointments',
    search_doctors: 'Searching for doctors',
    get_doctor_availability: 'Checking available slots',
    list_my_prescriptions: 'Fetching your prescriptions',
    get_health_summary: 'Reviewing your health record',
    assess_symptoms: 'Reviewing your symptoms',
    get_consultation_summary: 'Opening that consultation',
    navigate: 'Opening the page',
}

function toolLabel(name) {
    return TOOL_LABELS[name] || 'Working on that'
}

/**
 * Mounts the `/voice` namespace.
 *
 * `io` is the existing Socket.IO server from `server.js`, so the voice channel inherits
 * its transport, its Redis adapter when one is configured, and its payload limits.
 */
function attachVoiceGateway(io, options) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || apiKey.trim() === '') {
        console.warn(
            '[voice] GEMINI_API_KEY is not set — the voice receptionist is disabled. ' +
                'Everything else runs normally.',
        )
        return
    }

    const ai = new GoogleGenAI({ apiKey })
    const namespace = io.of(VOICE_NAMESPACE)

    namespace.use((socket, nextFn) => {
        try {
            const jar = parseCookies(socket.handshake.headers.cookie)
            const userId = sessionId(jar, USER_COOKIE, 'user')
            // Patients only. A doctor's or admin's session must not open a receptionist
            // that reads from the patient tool surface.
            if (!userId) return nextFn(new Error('Please sign in to use the voice assistant'))

            // Microphone contention with a live consultation. The WebRTC signaling
            // namespace holds a socket for the duration of a call, so its presence is a
            // reliable signal — and two things cannot own the microphone at once.
            const inConsultation = Array.from(io.sockets.sockets.values()).some(
                (s) => s.data && s.data.userId === userId,
            )
            if (inConsultation) {
                return nextFn(new Error('You are in a video consultation right now'))
            }

            socket.data.userId = userId
            nextFn()
        } catch (error) {
            console.error('[voice] authorization threw:', error)
            nextFn(new Error('Could not verify your session'))
        }
    })

    namespace.on('connection', (socket) => {
        const session = new VoiceSession(socket, {
            ai,
            baseUrl: options.baseUrl,
            internalSecret: options.internalSecret,
        })

        socket.on(ClientEvent.Start, (payload) => {
            session.start((payload && payload.language) || undefined).catch((error) => {
                console.error('[voice] start failed:', error)
                session.fail('internal', 'Could not start the voice assistant.', false)
            })
        })

        socket.on(ClientEvent.Audio, (chunk) => session.pushAudio(chunk))
        socket.on(ClientEvent.AudioEnd, () => session.endAudio())
        socket.on(ClientEvent.Text, (payload) => session.sendText(payload && payload.text))
        socket.on(ClientEvent.Interrupt, () => session.interrupt())
        socket.on(ClientEvent.Language, (payload) => {
            const language = payload && payload.language
            if (language) session.changeLanguage(language).catch(() => {})
        })
        socket.on(ClientEvent.Stop, () => session.dispose())
        socket.on('disconnect', () => session.dispose())
    })

    console.log(`[voice] receptionist gateway listening on ${VOICE_NAMESPACE}`)
}

module.exports = { attachVoiceGateway, VOICE_NAMESPACE }
