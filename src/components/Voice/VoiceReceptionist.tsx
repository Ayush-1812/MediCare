'use client'

/**
 * The voice receptionist surface.
 *
 * A voice interface is an accessibility surface in both directions, so nothing here is
 * audio-only: every state is written as well as spoken, the transcript is a live region,
 * the text field is a first-class input rather than a fallback, and all of it is reachable
 * from the keyboard. MediCare has no prior accessibility baseline to inherit (see the
 * Phase 1 audit), so this component sets its own.
 *
 * Every string comes from the message catalog. A panel that speaks Tamil while its buttons
 * read English tells the user their language is a gimmick rather than a supported
 * language, so the spoken and written layers are localized together or not at all.
 */

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppContext } from '@/context/AppContext'
import { useVoiceSession } from '@/lib/voice/useVoiceSession'
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/lib/voice/config'
import { localizationCoverage } from '@/lib/voice/i18n'
import type { VoiceState } from '@/lib/voice/protocol'
import type { MessageKey } from '@/lib/voice/messages'
import VoiceCards from './VoiceCards'
import {
    AlertCircle,
    Languages,
    Loader2,
    Mic,
    MicOff,
    Send,
    Square,
    Volume2,
    X,
} from 'lucide-react'

const STATE_KEYS: Record<VoiceState, MessageKey> = {
    idle: 'state_idle',
    connecting: 'state_connecting',
    listening: 'state_listening',
    thinking: 'state_thinking',
    speaking: 'state_speaking',
    reconnecting: 'state_reconnecting',
    error: 'state_error',
}

function StateDot({ state, level }: { state: VoiceState; level: number }) {
    if (state === 'listening') {
        return (
            <span className="relative flex h-3 w-3 items-center justify-center">
                <span
                    className="absolute inline-flex rounded-full bg-emerald-400/60"
                    // Driven by real mic level rather than a canned animation, so a user
                    // can see whether they are actually being picked up — the first thing
                    // anyone checks when a voice agent seems unresponsive.
                    style={{
                        height: `${0.75 + level * 1.5}rem`,
                        width: `${0.75 + level * 1.5}rem`,
                        transition: 'height 80ms linear, width 80ms linear',
                    }}
                />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
        )
    }

    if (state === 'speaking') return <Volume2 className="h-4 w-4 text-primary" aria-hidden />
    if (state === 'thinking' || state === 'connecting' || state === 'reconnecting') {
        return <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
    }
    if (state === 'error') return <AlertCircle className="h-4 w-4 text-red-500" aria-hidden />
    return <span className="h-3 w-3 rounded-full bg-gray-300" />
}

const VoiceReceptionist = () => {
    const { token } = useContext(AppContext)
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState('')
    const transcriptRef = useRef<HTMLDivElement | null>(null)

    const {
        state,
        transcript,
        error,
        activity,
        level,
        muted,
        language,
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
    } = useVoiceSession()

    const live = state !== 'idle' && state !== 'error'

    // Follow the conversation as it grows. `scrollTop` rather than `scrollIntoView` so
    // only the panel moves — `scrollIntoView` drags the whole page on mobile.
    useEffect(() => {
        const el = transcriptRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [transcript, activity])

    // Closing the panel must end the session, not hide a hot microphone behind a button.
    useEffect(() => {
        if (!open && live) stop()
    }, [open, live, stop])

    const statusLine = useMemo(() => {
        if (switchingLanguage) return t('switching_language')
        if (state === 'thinking' && activity) return activity
        if (muted && state === 'listening') return t('mic_muted')
        return t(STATE_KEYS[state])
    }, [switchingLanguage, state, activity, muted, t])

    /**
     * Languages whose interface strings are incomplete are marked rather than hidden.
     *
     * The assistant genuinely speaks all of these — each was verified against the
     * provider — so removing one would deny a working capability. But presenting a
     * half-translated interface as finished is the other failure. Marking it says what is
     * true: the voice works, some labels will appear in English.
     */
    const languageOptions = useMemo(
        () =>
            SUPPORTED_LANGUAGES.map((option) => {
                const coverage = localizationCoverage(option.code)
                return {
                    ...option,
                    label: coverage >= 0.9 ? option.label : `${option.label} *`,
                }
            }),
        [],
    )

    const anyPartial = useMemo(
        () => SUPPORTED_LANGUAGES.some((o) => localizationCoverage(o.code) < 0.9),
        [],
    )

    // Voice is a patient-facing feature; the gateway enforces this too, but there is no
    // reason to render a control that would be rejected.
    if (!token) return null

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={t('open_label')}
                className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
                <Mic className="h-6 w-6" aria-hidden />
            </button>
        )
    }

    return (
        <section
            aria-label={t('subtitle')}
            className="fixed bottom-6 right-6 z-40 flex max-h-[min(32rem,calc(100vh-3rem))] w-[min(22rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        >
            {/* ── Header ──────────────────────────────────────────────────── */}
            <header className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                <StateDot state={state} level={level} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{t('title')}</p>
                    {/* The one place state is announced to assistive tech. */}
                    <p className="truncate text-xs text-gray-500" aria-live="polite">
                        {statusLine}
                    </p>
                </div>

                <label className="sr-only" htmlFor="voice-language">
                    {t('language_label')}
                </label>
                <select
                    id="voice-language"
                    value={language}
                    onChange={(event) => changeLanguage(event.target.value as LanguageCode)}
                    title={anyPartial ? '* interface partly in English' : undefined}
                    className="max-w-[7rem] rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 focus:border-primary focus:outline-none"
                >
                    {languageOptions.map((option) => (
                        <option key={option.code} value={option.code}>
                            {option.label}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t('close_label')}
                    className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    <X className="h-4 w-4" aria-hidden />
                </button>
            </header>

            {/* ── Detected-language prompt ────────────────────────────────── */}
            {suggestion && (
                <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-2 text-xs text-indigo-900">
                    <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <p className="flex-1">{t('detected_prompt', { language: suggestion.label })}</p>
                    <button
                        type="button"
                        onClick={acceptSuggestion}
                        className="rounded-full bg-primary px-2.5 py-1 font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        {t('detected_switch')}
                    </button>
                    <button
                        type="button"
                        onClick={dismissSuggestion}
                        className="rounded-full px-2 py-1 text-indigo-700 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        {t('detected_dismiss')}
                    </button>
                </div>
            )}

            {/* ── Error ───────────────────────────────────────────────────── */}
            {error && (
                <div
                    role="alert"
                    className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800"
                >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <p>{error.message}</p>
                </div>
            )}

            {/* ── Transcript ──────────────────────────────────────────────── */}
            <div
                ref={transcriptRef}
                role="log"
                aria-live="polite"
                aria-label={t('transcript_label')}
                className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3"
            >
                {transcript.length === 0 && (
                    <div className="py-6 text-center">
                        <p className="text-sm text-gray-500">
                            {live ? t('empty_live') : t('empty_idle')}
                        </p>
                        <p className="mt-2 text-xs text-gray-400">{t('empty_hint')}</p>
                        <p className="mt-2 text-xs text-gray-400">{t('privacy_note')}</p>
                    </div>
                )}

                {transcript.map((entry) => (
                    <div
                        key={entry.id}
                        className={entry.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                    >
                        <p
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                entry.role === 'user'
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-100 text-gray-800'
                            } ${entry.final ? '' : 'opacity-70'}`}
                        >
                            {entry.text}
                        </p>
                    </div>
                ))}

                {(cards.length > 0 || pending?.state === 'awaiting') && (
                    <VoiceCards
                        cards={cards}
                        pending={pending}
                        t={t}
                        onDecide={decide}
                        onRequestLocation={requestLocation}
                        locationState={locationState}
                    />
                )}

                {state === 'thinking' && activity && (
                    <p className="px-1 text-xs italic text-gray-400">{activity}</p>
                )}
            </div>

            {/* ── Controls ────────────────────────────────────────────────── */}
            <div className="border-t border-gray-100 px-3 py-2.5">
                <div className="flex items-center gap-2">
                    {!live ? (
                        <button
                            type="button"
                            onClick={() => void start()}
                            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            <Mic className="h-4 w-4" aria-hidden /> {t('start_talking')}
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => setMuted(!muted)}
                                aria-pressed={muted}
                                aria-label={muted ? t('unmute') : t('mute')}
                                className={`rounded-full p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                    muted
                                        ? 'bg-red-50 text-red-600'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {muted ? (
                                    <MicOff className="h-4 w-4" aria-hidden />
                                ) : (
                                    <Mic className="h-4 w-4" aria-hidden />
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={interrupt}
                                // Deliberately always enabled: the user should not have to
                                // judge whether the assistant is "currently" speaking
                                // before they can stop it.
                                aria-label={t('stop_speaking')}
                                className="rounded-full bg-gray-100 p-2 text-gray-600 transition-colors hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                <Square className="h-4 w-4" aria-hidden />
                            </button>

                            <button
                                type="button"
                                onClick={stop}
                                className="ml-auto rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                {t('end_call')}
                            </button>
                        </>
                    )}
                </div>

                <form
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (!draft.trim()) return
                        sendText(draft)
                        setDraft('')
                    }}
                    className="mt-2 flex items-center gap-2"
                >
                    <label className="sr-only" htmlFor="voice-text">
                        {t('text_input_label')}
                    </label>
                    <input
                        id="voice-text"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={live ? t('type_instead') : t('type_disabled')}
                        disabled={!live}
                        className="flex-1 rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-primary focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <button
                        type="submit"
                        disabled={!live || !draft.trim()}
                        aria-label={t('send')}
                        className="rounded-full bg-primary p-2 text-white transition-colors hover:opacity-90 disabled:bg-gray-200 disabled:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <Send className="h-4 w-4" aria-hidden />
                    </button>
                </form>
            </div>
        </section>
    )
}

export default VoiceReceptionist
