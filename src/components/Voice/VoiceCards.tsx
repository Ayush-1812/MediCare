'use client'

/**
 * Structured results rendered beside the spoken conversation.
 *
 * Two reasons these exist rather than leaving everything to speech. First, the assistant
 * is instructed to offer at most three options and never read a long list aloud — so the
 * panel is where a fourth doctor or a sixth slot can live without making the audio
 * unusable. Second, a consequential action needs a visual control: a spoken "yes" is the
 * primary path, but confirming a booking should also be possible by looking at the exact
 * details and pressing a button.
 *
 * Everything here is driven by typed `uiPayload` data from the tool layer, never by
 * parsing what the assistant said. Parsing speech would break the moment the phrasing
 * changed — and it changes every time the language does.
 */

import React from 'react'
import type { PendingPayload, UiPayload } from '@/lib/voice/protocol'
import type { Translator } from '@/lib/voice/i18n'
import type { MessageKey } from '@/lib/voice/messages'
import { Check, MapPin, Stethoscope, X, Clock, CalendarCheck } from 'lucide-react'

type Props = {
    cards: UiPayload[]
    pending: PendingPayload | null
    t: Translator
    onDecide: (approved: boolean) => void
    onRequestLocation: () => void
    locationState: string
}

/** Catalog lookup that tolerates a key the server sent but the catalog lacks. */
function tk(t: Translator, key: string): string {
    return t(key as MessageKey)
}

function Shell({
    icon,
    title,
    children,
}: {
    icon: React.ReactNode
    title: string
    children: React.ReactNode
}) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                {icon}
                {title}
            </p>
            {children}
        </div>
    )
}

const VoiceCards = ({
    cards,
    pending,
    t,
    onDecide,
    onRequestLocation,
    locationState,
}: Props) => {
    const confirmCard = cards.find((c) => c.kind === 'confirm')
    const awaiting = pending?.state === 'awaiting'

    return (
        <div className="space-y-2">
            {/* ── Confirmation ─────────────────────────────────────────────
                Rendered only while the server says a proposal is genuinely pending, so
                the buttons cannot outlive the action they belong to. */}
            {awaiting && confirmCard?.kind === 'confirm' && (
                <div
                    role="group"
                    aria-label={tk(t, confirmCard.titleKey)}
                    className="rounded-xl border-2 border-primary/40 bg-indigo-50/60 p-3"
                >
                    <p className="mb-2 text-xs font-semibold text-gray-800">
                        {tk(t, confirmCard.titleKey)}
                    </p>
                    <dl className="mb-3 space-y-1">
                        {confirmCard.lines.map((line) => (
                            <div key={line.labelKey} className="flex gap-2 text-xs">
                                <dt className="shrink-0 text-gray-500">{tk(t, line.labelKey)}</dt>
                                <dd className="font-medium text-gray-900">{line.value}</dd>
                            </div>
                        ))}
                    </dl>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => onDecide(true)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                        >
                            <Check className="h-3.5 w-3.5" aria-hidden /> {t('btn_confirm')}
                        </button>
                        <button
                            type="button"
                            onClick={() => onDecide(false)}
                            className="flex items-center justify-center gap-1.5 rounded-full border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <X className="h-3.5 w-3.5" aria-hidden /> {t('btn_reject')}
                        </button>
                    </div>
                </div>
            )}

            {cards.map((card, index) => {
                const key = `${card.kind}-${index}`

                if (card.kind === 'confirm') return null

                if (card.kind === 'location_consent') {
                    return (
                        <Shell
                            key={key}
                            icon={<MapPin className="h-3.5 w-3.5" aria-hidden />}
                            title={t('card_pharmacies')}
                        >
                            <p className="mb-2 text-xs text-gray-600">{t('location_why')}</p>
                            {locationState === 'denied' ? (
                                <p className="text-xs text-amber-700">{t('location_denied')}</p>
                            ) : locationState === 'unavailable' ? (
                                <p className="text-xs text-amber-700">{t('location_unavailable')}</p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={onRequestLocation}
                                    disabled={locationState === 'requesting'}
                                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    {locationState === 'requesting'
                                        ? t('location_requesting')
                                        : t('allow_location')}
                                </button>
                            )}
                        </Shell>
                    )
                }

                if (card.kind === 'doctor') {
                    return (
                        <Shell
                            key={key}
                            icon={<Stethoscope className="h-3.5 w-3.5" aria-hidden />}
                            title={card.name}
                        >
                            <p className="text-xs text-gray-600">
                                {[card.speciality, card.hospital, card.city]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </p>
                            {card.fee !== null && card.fee !== undefined && (
                                <p className="mt-1 text-xs text-gray-700">
                                    {t('card_fee')}: ₹{card.fee}
                                </p>
                            )}
                        </Shell>
                    )
                }

                if (card.kind === 'doctors') {
                    return (
                        <Shell
                            key={key}
                            icon={<Stethoscope className="h-3.5 w-3.5" aria-hidden />}
                            title={t('card_doctor')}
                        >
                            <ul className="space-y-1">
                                {card.doctors.map((d) => (
                                    <li key={d.id} className="flex justify-between gap-2 text-xs">
                                        <span className="font-medium text-gray-800">{d.name}</span>
                                        <span className="text-gray-500">
                                            {d.speciality ?? ''}
                                            {d.fee != null ? ` · ₹${d.fee}` : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </Shell>
                    )
                }

                if (card.kind === 'slots') {
                    return (
                        <Shell
                            key={key}
                            icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
                            title={`${t('card_slots')} — ${card.date}`}
                        >
                            {/* Display only. Choosing a slot stays a spoken or typed act so
                                there is one path into a booking, not two. */}
                            <div className="flex flex-wrap gap-1.5">
                                {card.times.map((time) => (
                                    <span
                                        key={time}
                                        className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-700"
                                    >
                                        {time.toLowerCase()}
                                    </span>
                                ))}
                            </div>
                        </Shell>
                    )
                }

                if (card.kind === 'appointments') {
                    return (
                        <Shell
                            key={key}
                            icon={<CalendarCheck className="h-3.5 w-3.5" aria-hidden />}
                            title={t('card_appointments')}
                        >
                            <ul className="space-y-1.5">
                                {card.appointments.map((a) => (
                                    <li key={a.id} className="text-xs">
                                        <span className="font-medium text-gray-800">{a.doctor}</span>
                                        <span className="text-gray-500"> · {a.when}</span>
                                        {a.canJoinNow && (
                                            <span className="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                                {t('card_join_now')}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </Shell>
                    )
                }

                if (card.kind === 'pharmacies') {
                    return (
                        <Shell
                            key={key}
                            icon={<MapPin className="h-3.5 w-3.5" aria-hidden />}
                            title={t('card_pharmacies')}
                        >
                            <ul className="space-y-1.5">
                                {card.pharmacies.map((p, i) => (
                                    <li key={i} className="text-xs">
                                        {/* Third-party text. Rendered as plain text nodes, never
                                            as markup, and shown with the untrusted wrapper
                                            stripped for readability. */}
                                        <span className="font-medium text-gray-800">
                                            {stripWrapper(String(p.name ?? ''))}
                                        </span>
                                        {p.distanceKm != null && (
                                            <span className="text-gray-500">
                                                {' '}
                                                · {Number(p.distanceKm).toFixed(1)} km
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </Shell>
                    )
                }

                return null
            })}
        </div>
    )
}

/**
 * Removes the untrusted-content markers before display.
 *
 * Those delimiters exist to tell the *model* what is data rather than instruction; showing
 * them to a patient would be noise. The content is still only ever rendered as a text
 * node, so stripping the markers changes nothing about safety.
 */
function stripWrapper(text: string): string {
    return text
        .replace(/<<<UNTRUSTED_CONTENT[^>]*>/g, '')
        .replace(/END_UNTRUSTED_CONTENT>>>/g, '')
        .trim()
}

export default VoiceCards
