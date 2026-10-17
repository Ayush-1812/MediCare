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
const { PendingActionStore } = require('./pendingActions')

/** Shared across sessions; keyed internally by user and socket. */
const pendingActions = new PendingActionStore()

/**
 * Tools the gateway answers itself, because they operate on the pending-action store,
 * which lives with the session rather than in Next. Mirrors `GATEWAY_TOOLS` in
 * `src/lib/voice/tools/definitions.ts`.
 */
const GATEWAY_TOOLS = new Set(['confirm_action', 'cancel_pending_action'])

const VOICE_NAMESPACE = '/voice'

const ClientEvent = {
    Start: 'voice:start',
    /** Coordinates the patient granted via the panel's location button. */
    Location: 'voice:location',
    /** Confirm or reject the pending action from the UI card rather than by speaking. */
    Decide: 'voice:decide',
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
    /** Structured data for the panel to render (doctor cards, slots, confirm card). */
    Ui: 'voice:ui',
    /** A proposal is awaiting confirmation, or has been resolved. */
    Pending: 'voice:pending',
}

const AUDIO_HEADER_BYTES = 8

/**
 * Opt-in per-turn timing trace: VOICE_TRACE=1 npm run dev
 *
 * Prints where each turn spends its time — speech ending, the model asking for a tool,
 * the tool answering, the first audio going out. Written because "it is slow" had
 * several candidate causes and only a timeline separates them. Off by default: it logs
 * tool names and timings, never transcripts or anything a patient said.
 */
const TRACE = process.env.VOICE_TRACE === '1'

/**
 * Optional `scheduling` on tool responses. Unset by default — see the measurement notes
 * where tool behaviour is declared in src/lib/voice/tools/definitions.ts. The docs say
 * scheduling applies only to NON_BLOCKING calls, and sending it alongside BLOCKING was
 * measured to coincide with every tool call after the first stalling for 26-51 seconds.
 */
const TOOL_SCHEDULING = process.env.VOICE_TOOL_SCHEDULING || null
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
        /** Resolved from the patient's browser; feeds date handling in the prompt. */
        this.timeZone = null

        /**
         * Plain-text turns, oldest first.
         *
         * Kept because a language change needs a brand-new provider session — the Live
         * API fixes `speechConfig.languageCode` at setup — and reconnecting with an empty
         * context would drop the patient mid-task, which is exactly what Phase 3 forbids.
         * Provider-side resumption handles cannot be relied on across a config change, so
         * the conversation is replayed explicitly instead. Capped: this is dialogue, and
         * an unbounded buffer on a long session is a slow leak.
         */
        this.history = []
        this.HISTORY_LIMIT = 24
        /** Accumulates the current assistant turn's transcript for the history. */
        this.assistantTurnText = ''

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
         * Coordinates from the browser, set only after the patient granted permission.
         * Injected into the pharmacy tool's arguments so the model never supplies a
         * location — a guessed latitude returns confidently wrong pharmacies.
         */
        this.coords = null

        /** VOICE_TRACE timeline anchor: when the current user turn's speech was heard. */
        this.traceStart = 0
        this.traceFirstAudio = false

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

    trace(event) {
        if (!TRACE) return
        const at = this.traceStart ? `+${Date.now() - this.traceStart}ms` : 'start'
        console.log(`[voice:trace] turn ${this.turnId} ${at.padStart(8)}  ${event}`)
    }

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

    /** Appends a completed turn to the replayable history. */
    remember(role, text) {
        const trimmed = String(text || '').trim()
        if (!trimmed) return
        this.history.push({ role, text: trimmed })
        if (this.history.length > this.HISTORY_LIMIT) {
            this.history.splice(0, this.history.length - this.HISTORY_LIMIT)
        }
    }

    /** Fetches this session's config from Next, then opens the provider connection. */
    async start(language, timeZone) {
        if (timeZone) this.timeZone = timeZone
        const bootstrap = await this.fetchJson('/api/voice/session', {
            language,
            timeZone: this.timeZone,
        })
        if (!bootstrap || !bootstrap.ok) {
            const status = bootstrap && bootstrap.__status
            if (status === 401) {
                return this.fail('unauthorized', 'Please sign in again to use the voice assistant.', false)
            }
            return this.fail('internal', 'Could not start the voice assistant.', false)
        }

        this.language = bootstrap.language
        this.timeZone = bootstrap.timeZone || this.timeZone
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

        if (TRACE && message.usageMetadata) {
            const u = message.usageMetadata
            this.trace(
                `usage: prompt=${u.promptTokenCount ?? '?'} response=${u.responseTokenCount ?? '?'} total=${u.totalTokenCount ?? '?'}`,
            )
        }

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
            if (!this.traceStart) {
                this.traceStart = Date.now()
                this.traceFirstAudio = false
                this.trace('user speech recognised')
            }
            this.remember('user', content.inputTranscription.text)
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
            // Accumulated rather than remembered per fragment: the provider streams the
            // assistant's transcript in pieces, and a history of word-fragments would be
            // useless to replay.
            this.assistantTurnText += content.outputTranscription.text
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
            if (!this.traceFirstAudio) {
                this.traceFirstAudio = true
                this.trace('first audio out')
            }
            if (this.state !== 'speaking') this.setState('speaking')
            this.socket.emit(
                ServerEvent.Audio,
                encodeAudioFrame(this.turnId, this.audioSeq++, pcm),
            )
        }

        /**
         * `generationComplete` is NOT a turn boundary.
         *
         * The provider sends both signals for a single turn: `generationComplete` when
         * the model stops generating, then `turnComplete` when the turn actually ends
         * (after any tool round trip). Treating them as interchangeable — which this did —
         * fired the boundary twice and incremented `turnId` twice per turn.
         *
         * That is not cosmetic. The browser drops any audio frame whose `turnId` is below
         * the turn it believes is current, so a counter running one ahead means the NEXT
         * reply's audio is discarded as stale and the assistant simply goes silent. It
         * survives a slow test that waits between turns, because both events land before
         * the next turn starts; a person answering promptly loses the reply. That is the
         * "it replies once and then never again" report.
         *
         * So: generation finishing only moves the UI out of "speaking". Only
         * `turnComplete` closes the turn.
         */
        if (content.generationComplete && !content.turnComplete) {
            this.trace('generation complete')
            this.setState('listening')
        }

        if (content.turnComplete) {
            this.trace('turn complete')
            this.traceStart = 0
            const finished = this.turnId
            this.remember('assistant', this.assistantTurnText)
            this.assistantTurnText = ''
            this.socket.emit(ServerEvent.TurnComplete, { turnId: finished })
            this.turnId += 1
            this.audioSeq = 0
            this.setState('listening')
        }
    }

    // ── Tool calls ──────────────────────────────────────────────────────────

    runToolCalls(calls) {
        this.trace(`model requested: ${calls.map((c) => c.name).join(', ')}`)
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

        // Location is attached here rather than accepted from the model. The tool's
        // declared schema has no coordinate fields at all, so this is the only way a
        // position can reach it, and it exists only once the patient has consented.
        const toolArgs =
            name === 'find_nearby_pharmacies' ? { ...args, __coords: this.coords } : args

        const response = GATEWAY_TOOLS.has(name)
            ? await this.handleGatewayTool(name, args)
            : await this.fetchJson('/api/voice/tool', { name, args: toolArgs })

        /**
         * A result is void only if the call was genuinely abandoned: the provider
         * cancelled it (`toolCallCancellation`), the patient interrupted (which marks
         * pending calls cancelled in `cancelCurrentTurn`), or the session ended.
         *
         * It is NOT void because `turnId` moved on. This used to also discard any result
         * whose turn had changed — and a NORMAL `turnComplete` changes it. When the model
         * requests a tool it closes that turn with `turnComplete` and then waits for the
         * result; the gateway bumped `turnId` on that turnComplete, so a result arriving
         * afterwards failed the comparison and was thrown away as stale. The model then
         * waited forever for a tool response that never came, and the patient heard
         * nothing.
         *
         * That race depended on timing, which is why it hid for so long. With the old
         * 1-10 second database, results usually arrived after turnComplete and were
         * silently dropped — one real cause of "not responding on time". With the
         * cache returning in ~50ms and no spoken bridge to delay turnComplete, it lost the
         * race every single time and the agent went completely silent, which is what
         * finally made it visible.
         *
         * Interruption is still honoured, through the right mechanism: `cancelCurrentTurn`
         * sets `pending.cancelled`, which is checked here.
         */
        if (this.closed || pending.cancelled) {
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

        // A proposal came back. Stored server-side, keyed to this user and socket, so the
        // confirmation that follows commits these exact parameters and not whatever the
        // model happens to pass later.
        if (ok && response.pendingAction) {
            const record = pendingActions.propose(this.userId, this.socket.id, response.pendingAction)
            this.socket.emit(ServerEvent.Pending, {
                state: 'awaiting',
                action: record.action,
                summary: record.summary,
                expiresInMs: record.expiresAt - Date.now(),
            })
        }

        if (ok && response.uiPayload) {
            this.socket.emit(ServerEvent.Ui, { ...response.uiPayload, turnId })
        }

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
                        // Belt and braces for the BLOCKING declaration in definitions.ts.
                        // If a model ever treats a call as non-blocking, the default
                        // `WHEN_IDLE` scheduling waits for the model to go idle — which a
                        // continuously streaming microphone never allows — and the answer
                        // lands a turn late. INTERRUPT means "add the result and generate
                        // now". It is ignored for blocking calls, so it costs nothing there.
                        ...(TOOL_SCHEDULING ? { scheduling: TOOL_SCHEDULING } : {}),
                    },
                ],
            })
            this.trace(`tool response sent: ${name}`)
        } catch (error) {
            console.error('[voice] sendToolResponse failed:', error)
        }
    }

    /**
     * Tools the gateway answers itself.
     *
     * `confirm_action` is the only path to a mutation, and the parameters it commits come
     * from the pending-action store — never from the model's arguments. The model may name
     * which action it believes it is confirming, and that is checked against the stored
     * record, but it cannot supply a doctor, a date or a time here. If the conversation and
     * the store have diverged, the commit is refused and the agent is told to propose
     * again rather than guess which one the patient meant.
     */
    async handleGatewayTool(name, args) {
        if (name === 'cancel_pending_action') {
            const had = pendingActions.invalidate(this.userId, this.socket.id)
            this.socket.emit(ServerEvent.Pending, { state: 'cancelled' })
            return {
                ok: true,
                data: had
                    ? { cancelled: true, note: 'The proposal was discarded. Nothing was changed.' }
                    : { cancelled: false, note: 'There was nothing pending.' },
            }
        }

        // confirm_action
        const claim = pendingActions.claim(this.userId, this.socket.id, {
            action: typeof args.action === 'string' ? args.action : undefined,
        })

        if (!claim.ok) {
            this.socket.emit(ServerEvent.Pending, { state: 'invalid', reason: claim.reason })
            const explanation = {
                none:
                    'There is nothing pending to confirm. Nothing has been changed. Propose the ' +
                    'action again before confirming.',
                expired:
                    'That proposal expired because too long passed. Nothing has been changed. ' +
                    'Tell the patient you will set it up again, re-check availability, and propose ' +
                    'afresh.',
                mismatch:
                    'That does not match what is pending, so nothing has been changed. Do not ' +
                    'guess — propose the action again with the details the patient just gave.',
            }
            return {
                ok: false,
                data: { committed: false, reason: claim.reason, error: explanation[claim.reason] },
            }
        }

        const record = claim.record

        // A completed action replayed instead of re-executed. This is what makes a
        // reconnection safe: the same idempotency key returns the original outcome rather
        // than booking a second appointment.
        const earlier = pendingActions.resultFor(record.idempotencyKey)
        if (earlier) {
            this.socket.emit(ServerEvent.Pending, { state: 'done', replayed: true })
            return earlier
        }

        const response = await this.fetchJson('/api/voice/commit', {
            action: record.action,
            params: record.params,
        })

        if (!response) {
            // Transport died with the write in flight. Its outcome is genuinely unknown,
            // so it is recorded as such and NOT retried — the agent is instructed to read
            // the real state back instead.
            const unknown = {
                ok: false,
                data: {
                    committed: false,
                    outcomeUnknown: true,
                    error:
                        'The connection dropped while that was being saved, so it is unclear ' +
                        'whether it went through. Tell the patient you are checking, then read ' +
                        'their appointments back. Do not try the change again.',
                },
            }
            pendingActions.recordResult(record.idempotencyKey, unknown)
            this.socket.emit(ServerEvent.Pending, { state: 'unknown' })
            return unknown
        }

        pendingActions.recordResult(record.idempotencyKey, response)
        this.socket.emit(ServerEvent.Pending, {
            state: response.ok ? 'done' : 'failed',
            action: record.action,
        })
        return response
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
        this.remember('user', trimmed)
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

    /**
     * Resolves the pending action from the UI buttons.
     *
     * Runs the identical store claim and commit path a spoken confirmation takes, then
     * tells the model what happened as a user turn so it can narrate the real outcome.
     * The alternative — having the button call the backend directly and leaving the model
     * to find out later — produces an assistant that cheerfully asks for a confirmation
     * that already happened.
     */
    async decidePending(approved) {
        if (this.closed) return

        const result = await this.handleGatewayTool(
            approved ? 'confirm_action' : 'cancel_pending_action',
            {},
        )

        if (!this.live) return
        const note = approved
            ? `[The patient pressed Confirm. Result: ${JSON.stringify(result.data)}. Tell them what actually happened, and nothing more.]`
            : '[The patient pressed Cancel. Nothing was changed. Acknowledge briefly and ask what they would like instead.]'

        try {
            this.live.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: note }] }],
                turnComplete: true,
            })
            this.setState('thinking')
        } catch (error) {
            console.error('[voice] decide relay failed:', error)
        }
    }

    /**
     * Manual stop button: stop the current reply without tearing down the session.
     *
     * This used to send `activityStart` / `activityEnd` to the provider. Those are the
     * MANUAL voice-activity signals, valid only when `automaticActivityDetection` is
     * disabled — and we deliberately leave automatic detection on, so sending them was an
     * API misuse. It appeared to "work" because an explicit activity end forces a turn
     * boundary, which is why pressing stop seemed to make the assistant finally answer;
     * what it was really doing was papering over the double-increment bug above while
     * putting the session into a state we never designed for.
     *
     * With automatic detection on there is no separate cancel to send: the provider
     * abandons its turn when it hears the user speak. So stopping is a local act — bump
     * the turn so any audio still in flight is dropped, and flush what is queued. The
     * patient stops hearing it immediately, which is what the button promises.
     */
    interrupt() {
        if (this.closed) return
        const interrupted = this.cancelCurrentTurn()
        this.socket.emit(ServerEvent.Interrupted, { turnId: interrupted })
        this.setState('listening')
    }

    /**
     * Switches spoken language without losing the task in progress.
     *
     * `speechConfig.languageCode` is fixed when a Live session is set up, so this has to
     * open a new one. What must NOT happen is the patient losing their place: someone who
     * has just picked a doctor and a slot, then switches to Hindi to finish, cannot be
     * dropped back at "how can I help you".
     *
     * So the conversation so far is replayed into the new session as context, with
     * `turnComplete: false` — the model receives the history but is not asked to respond
     * to it, leaving it ready for the patient's next utterance with everything it knew
     * before. The transcript on screen is deliberately left intact too.
     */
    async changeLanguage(language) {
        if (this.closed) return

        this.cancelCurrentTurn()
        this.assistantTurnText = ''
        try {
            if (this.live) this.live.close()
        } catch {
            /* ignore */
        }
        this.live = null
        // A handle from the previous session belongs to the previous language config, so
        // it is dropped; `history` is what carries context across instead.
        this.resumeHandle = null
        this.setState('connecting')

        const carried = this.history.slice()
        await this.start(language)

        if (this.closed || !this.live || carried.length === 0) return

        try {
            this.live.sendClientContent({
                turns: carried.map((turn) => ({
                    role: turn.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: turn.text }],
                })),
                turnComplete: false,
            })
            console.log(`[voice] language -> ${language}, replayed ${carried.length} turns`)
        } catch (error) {
            // Context replay failing is not fatal: the session is live and usable, just
            // without memory of what came before. Better than refusing the switch.
            console.error('[voice] history replay failed:', error)
        }
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
            session
                .start(
                    (payload && payload.language) || undefined,
                    (payload && payload.timeZone) || undefined,
                )
                .catch((error) => {
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
        socket.on(ClientEvent.Location, (payload) => {
            const lat = Number(payload && payload.lat)
            const lng = Number(payload && payload.lng)
            // Validated here as well as in the browser: these reach an external search
            // provider, and `Number(undefined)` is NaN rather than a usable coordinate.
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return
            session.coords = { lat, lng }
            console.log('[voice] location consent granted')
        })

        /**
         * Confirm or reject from the UI card.
         *
         * The same pending record and the same commit path as a spoken yes — a button
         * press is not a second, weaker route to a mutation. Phrased as a synthetic user
         * turn so the model stays in step with what just happened.
         */
        socket.on(ClientEvent.Decide, (payload) => {
            const approved = Boolean(payload && payload.approved)
            session
                .decidePending(approved)
                .catch((error) => console.error('[voice] decide failed:', error))
        })

        socket.on(ClientEvent.Stop, () => session.dispose())
        socket.on('disconnect', () => {
            pendingActions.clearSession(socket.data.userId, socket.id)
            session.dispose()
        })
    })

    console.log(`[voice] receptionist gateway listening on ${VOICE_NAMESPACE}`)
}

module.exports = { attachVoiceGateway, VOICE_NAMESPACE }
