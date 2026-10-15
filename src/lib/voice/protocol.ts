/**
 * Wire protocol between the browser and the voice gateway.
 *
 * Audio travels as raw binary (`ArrayBuffer` / `Buffer`) because base64 would add a
 * third again to a continuous 32 KB/s uplink for no benefit — Socket.IO frames binary
 * natively. Everything else is JSON.
 *
 * `turnId` appears on every assistant-produced message and is the mechanism behind
 * interruption safety: the gateway increments it the moment the provider reports a
 * barge-in, and the client discards anything still arriving for an older turn. Without
 * it, audio already in flight when the user interrupts keeps playing over them.
 */

import type { LanguageCode } from './config'

export const VOICE_NAMESPACE = '/voice'

/** UI state machine. Exactly one of these is true at any moment. */
export type VoiceState =
    | 'idle'
    | 'connecting'
    | 'listening'
    | 'thinking'
    | 'speaking'
    | 'reconnecting'
    | 'error'

/** Errors are classified so the UI can tell "ask again" apart from "this is broken". */
export type VoiceErrorCode =
    | 'unauthorized'
    | 'mic_denied'
    | 'mic_unavailable'
    | 'mic_in_use'
    | 'provider_unavailable'
    | 'provider_quota'
    | 'session_expired'
    | 'consultation_active'
    | 'network'
    | 'internal'

// ─── Client → Server ─────────────────────────────────────────────────────────

export const ClientEvent = {
    /** Open a Live session. Sent once after the socket connects. */
    Start: 'voice:start',
    /** Coordinates, sent only after the patient grants browser location permission. */
    Location: 'voice:location',
    /** Confirm or reject the pending action using the card's buttons. */
    Decide: 'voice:decide',
    /** One frame of captured PCM16 @16 kHz, mono. Binary payload. */
    Audio: 'voice:audio',
    /** Mic closed or muted — tells the provider the user's turn is over. */
    AudioEnd: 'voice:audio-end',
    /** Typed message instead of speech. Same session, same tools. */
    Text: 'voice:text',
    /** User pressed stop: cancel the current turn without closing the session. */
    Interrupt: 'voice:interrupt',
    /** Switch spoken language mid-session (reconnects the provider session). */
    Language: 'voice:language',
    /** Close the session deliberately. */
    Stop: 'voice:stop',
} as const

export type StartPayload = {
    language?: LanguageCode
    /**
     * IANA zone from the browser, e.g. "Asia/Kolkata". Sent because every date the
     * assistant speaks or confirms has to be in the patient's own zone — "tomorrow
     * evening" is meaningless otherwise, and a server-side guess books the wrong day.
     */
    timeZone?: string
    /** Set when resuming after a transport drop, so completed actions are not repeated. */
    sessionId?: string
}

export type TextPayload = { text: string }
export type LanguagePayload = { language: LanguageCode }

// ─── Server → Client ─────────────────────────────────────────────────────────

export const ServerEvent = {
    /** Live session established and configured. */
    Ready: 'voice:ready',
    /** Current state machine value. */
    State: 'voice:state',
    /** One chunk of synthesized PCM16 @24 kHz. Binary payload, prefixed header. */
    Audio: 'voice:audio',
    /** Incremental or final transcript line. */
    Transcript: 'voice:transcript',
    /** Barge-in: drop queued audio for turns at or below `turnId`. */
    Interrupted: 'voice:interrupted',
    /** A tool started or finished — drives the "thinking" detail line. */
    Tool: 'voice:tool',
    /** The assistant finished a turn. */
    TurnComplete: 'voice:turn-complete',
    /** Provider is about to drop the connection; gateway will resume transparently. */
    Reconnecting: 'voice:reconnecting',
    Error: 'voice:error',
    /** Structured data for the panel to render alongside the spoken answer. */
    Ui: 'voice:ui',
    /** Lifecycle of a consequential action awaiting (or past) confirmation. */
    Pending: 'voice:pending',
} as const

export type LocationPayload = { lat: number; lng: number }
export type DecidePayload = { approved: boolean }

/**
 * Renderable tool output.
 *
 * Kept separate from the text the model receives: the spoken copy is shaped for listening
 * ("three slots, which works best?") while the panel wants fields it can lay out. Having
 * the UI parse the spoken sentence instead would break the moment the phrasing changed, or
 * the language did.
 */
export type UiPayload =
    // Labels travel as catalog keys, not text, so a confirmation card reads in the
    // patient's own language. Values are real backend data and are shown verbatim.
    | { kind: 'confirm'; action: string; titleKey: string; lines: { labelKey: string; value: string }[]; turnId?: number }
    | { kind: 'doctor'; id: string; name: string; speciality?: string | null; fee?: number | null; city?: string | null; hospital?: string | null; turnId?: number }
    | { kind: 'doctors'; doctors: { id: string; name: string; speciality?: string | null; fee?: number | null }[]; turnId?: number }
    | { kind: 'slots'; doctorId: string; doctorName: string; slotDateKey: string; date: string; times: string[]; turnId?: number }
    | { kind: 'appointments'; appointments: { id: string; doctor: string; when: string; status: string; canJoinNow?: boolean }[]; turnId?: number }
    | { kind: 'pharmacies'; pharmacies: Record<string, unknown>[]; turnId?: number }
    | { kind: 'location_consent'; turnId?: number }

/** `awaiting` → the confirmation card is live; everything else closes it. */
export type PendingPayload = {
    state: 'awaiting' | 'done' | 'failed' | 'cancelled' | 'invalid' | 'unknown'
    action?: string
    summary?: string
    expiresInMs?: number
    reason?: string
    replayed?: boolean
}

export type ReadyPayload = {
    sessionId: string
    language: LanguageCode
    /** The zone the server actually accepted, which may differ if ours was rejected. */
    timeZone?: string
    model: string
    /** True when this resumed an existing session rather than starting fresh. */
    resumed: boolean
}

export type TranscriptPayload = {
    role: 'user' | 'assistant'
    text: string
    /** False for interim recognition that will be superseded. */
    final: boolean
    turnId: number
}

export type InterruptedPayload = { turnId: number }

export type ToolPayload = {
    name: string
    status: 'running' | 'done' | 'error' | 'cancelled'
    /** Short human-readable line for the UI, e.g. "Checking your appointments". */
    label: string
    turnId: number
}

export type TurnCompletePayload = { turnId: number }

export type ReconnectingPayload = {
    reason: 'provider_goaway' | 'provider_error' | 'transport'
    /** From `goAway.timeLeft` when the provider warned us. */
    timeLeftMs?: number
}

export type ErrorPayload = {
    code: VoiceErrorCode
    message: string
    /** False means the session is finished and the user must start a new one. */
    recoverable: boolean
}

/**
 * Audio frames carry an 8-byte little-endian header ahead of the PCM payload so the
 * client can drop stale audio without decoding it: `[turnId: uint32][seq: uint32]`.
 *
 * A separate JSON control message per chunk would double the message count on the
 * hottest path in the system, and would arrive out of band from the bytes it describes.
 */
export const AUDIO_HEADER_BYTES = 8

export function encodeAudioFrame(turnId: number, seq: number, pcm: Uint8Array): Uint8Array {
    const out = new Uint8Array(AUDIO_HEADER_BYTES + pcm.byteLength)
    const view = new DataView(out.buffer)
    view.setUint32(0, turnId, true)
    view.setUint32(4, seq, true)
    out.set(pcm, AUDIO_HEADER_BYTES)
    return out
}

export function decodeAudioFrame(buffer: ArrayBuffer): {
    turnId: number
    seq: number
    pcm: Uint8Array
} {
    const view = new DataView(buffer)
    return {
        turnId: view.getUint32(0, true),
        seq: view.getUint32(4, true),
        pcm: new Uint8Array(buffer, AUDIO_HEADER_BYTES),
    }
}
