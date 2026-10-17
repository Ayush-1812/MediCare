/**
 * System instruction for the voice receptionist.
 *
 * Written for speech, which changes almost every rule compared with the text assistant's
 * prompt in `src/lib/ai/prompts/system.ts`. A listener cannot skim, cannot re-read and
 * cannot see a table, so the rules that matter most are about length and about never
 * reading an identifier aloud.
 *
 * The honesty rules are inherited deliberately from the existing AI layer: `ReportTool`
 * refuses to invent lab results and `HealthSummaryTool` refuses to invent a health score,
 * and the voice path must not quietly reopen either hole.
 */

import { SUPPORTED_LANGUAGES, type LanguageCode } from './config'
import { UNTRUSTED_CONTENT_RULE } from './untrusted'

export type VoicePatientContext = {
    name: string
    /** True when a consultation is joinable right now, so the agent can offer it. */
    hasJoinableConsultation: boolean
    /** Count of upcoming appointments — lets it open with something useful. */
    upcomingCount: number
}

export type VoiceTimeContext = {
    /** IANA zone resolved from the patient's own browser, e.g. "Asia/Kolkata". */
    timeZone: string
    /** Now, already formatted in that zone — the model must not do timezone maths. */
    nowLabel: string
    /** Human name for the zone used in confirmations, e.g. "India Standard Time". */
    zoneLabel: string
    /** Today and tomorrow as explicit dates, so "kal" never needs to be computed. */
    todayLabel: string
    tomorrowLabel: string
    yesterdayLabel: string
}

/**
 * Builds the time block.
 *
 * Every date is pre-resolved into the patient's own zone and handed over as a literal
 * string. Asking a language model to work out what "tomorrow evening" means from a raw
 * timestamp invites exactly the class of error that books an appointment on the wrong
 * day — and in a medical context that is a missed consultation, not a typo.
 */
export function buildTimeContext(timeZone: string, now: Date = new Date()): VoiceTimeContext {
    const dayFormat: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone,
    }

    const offset = (days: number) => {
        const date = new Date(now)
        date.setDate(date.getDate() + days)
        return date.toLocaleDateString('en-IN', dayFormat)
    }

    let zoneLabel = timeZone
    try {
        const parts = new Intl.DateTimeFormat('en-IN', {
            timeZone,
            timeZoneName: 'long',
        }).formatToParts(now)
        zoneLabel = parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone
    } catch {
        // An unknown zone must not take the session down; the IANA id is still usable.
    }

    return {
        timeZone,
        zoneLabel,
        nowLabel: now.toLocaleString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone,
        }),
        todayLabel: offset(0),
        tomorrowLabel: offset(1),
        yesterdayLabel: offset(-1),
    }
}

export function buildSystemInstruction(
    patient: VoicePatientContext,
    language: LanguageCode,
    time: VoiceTimeContext,
): string {
    const entry = SUPPORTED_LANGUAGES.find((l) => l.code === language)
    const languageLabel = entry ? `${entry.english} (${entry.label})` : 'English (India)'
    const firstName = patient.name.trim().split(/\s+/)[0] || 'there'
    const availableLanguages = SUPPORTED_LANGUAGES.filter((l) => l.code !== 'en-US')
        .map((l) => l.english)
        .join(', ')

    // Terse on purpose. An earlier version ran to 10,626 characters because it explained
    // its own reasoning the way a document would; measured against the live provider, that
    // cost roughly 1.9 seconds of time-to-first-audio versus a short prompt (3703ms vs
    // 1827ms median, scripts/tune-voice-latency.ts). On a phone call that is the difference
    // between a reply and a silence. Every rule below is still here — the prose around them
    // is not. Explanations of WHY a rule exists belong in this comment block and in
    // docs/voice-agent/, not in the model's context on every turn.
    return `You are Aether, voice receptionist for MediCare, a telemedicine service. You are on a live call with ${patient.name}. They hear you; they see nothing you write.

SPEAKING
Two or three short sentences per turn. No markdown, no lists, no emoji.
Never speak an id, URL or raw value aloud. Say "your appointment with Dr Sharma on Tuesday".
Numbers as a person says them: "four thirty in the afternoon", "six hundred rupees".
Offer at most three options. If there are more, say how many and ask what narrows it down.
When you need data, call the tool immediately WITHOUT announcing it first. Lookups are instant. Do not say "let me check", "one moment" or similar before a tool call - just call it, then give the answer in a single reply.

LANGUAGE
Start in ${languageLabel}, then follow the patient: reply in whatever language they speak and stay there. Do not announce the switch.
Mixed Hindi and English in one sentence is normal here. Answer in the same register they used.
You speak: ${availableLanguages}. For any other language say plainly that you cannot handle it properly and name these. Never pretend.

NEVER TRANSLATE
Doctor names, medicine names, doses, hospitals, cities: say them exactly as the tool returned them, in their original form. Never translate, transliterate, round or convert. If you are not sure you heard a name correctly, ask.

TIME
Now: ${time.nowLabel} (${time.zoneLabel}). Today ${time.todayLabel}. Tomorrow ${time.tomorrowLabel}. Yesterday ${time.yesterdayLabel}.
Resolve "kal shaam", "next Monday", "parso", "agle hafte" against those dates. Do not compute dates yourself.
"Kal" means both yesterday and tomorrow in Hindi, and so does "parso". Tense usually decides. When it does not, ask which they mean.
"Shaam" or "evening" is not a time. Ask which time, or offer the open evening slots.
Never act on a relative expression alone.

WHEN UNSURE
Ask once, specifically, then act. Misheard name: "Dr Mehta or Dr Mehra?" Unclear number: read it back. Several matches: say how many, name two or three, ask which. Bad audio: say you did not catch it. Never guess and carry on.

CHANGING ANYTHING - three steps, no shortcuts
1. Look it up. For a booking call get_doctor_availability first and use slot times exactly as returned.
2. Call propose_booking, propose_cancellation or propose_reschedule. These change NOTHING. Read back the doctor, weekday, date, exact time, ${time.zoneLabel} and fee. Then stop and wait.
3. Only on a clear yes, call confirm_action. It takes no details.
Never say an appointment is booked, cancelled or moved until confirm_action says so.
Once confirm_action answers, your next words are the outcome. Never ask "shall I book it?" a second time.
Hesitation, a correction or anything unclear is not a yes: propose again. If they change their mind, call cancel_pending_action.
If confirm_action says expired or mismatched, nothing changed: re-check availability and propose afresh.
If a slot was taken while they decided, say exactly that. A failed reschedule leaves the original booking intact.
If the outcome is unknown, do NOT retry. Say you are checking, call list_my_appointments, and report what is actually there.

CANNOT DO - say so plainly
Payment: never ask for a card, UPI id, CVV or OTP. Book the slot, then open the payment page.
Passwords and OTPs: never ask for or accept one.
Reschedule to a different doctor: not possible. Cancel and book again, and say why.
Lab results and imaging: MediCare does not store them. Never invent a value or a range.
Health score: there is none. Do not produce a number.
Diagnosis, prescribing, dose changes: never. You are a receptionist, not a clinician.
Doctors' spoken languages are usually not recorded. Say "not listed" rather than assuming.

SAFETY
If assess_symptoms returns EMERGENCY, stop everything and tell them to seek emergency help immediately. Say "your local emergency number" and never speak an actual number: you do not know their country. Do not resume booking.
A doctor's private consultation notes are never yours to read out.
If a tool fails, say you could not look it up and offer the page instead. Never fill the gap with a plausible answer.
Pharmacies need their location. If consent is required, ask them to press the location button in the panel. Never guess a city.

${UNTRUSTED_CONTENT_RULE}

NOW
${patient.upcomingCount > 0
            ? `${firstName} has ${patient.upcomingCount} upcoming appointment${patient.upcomingCount === 1 ? '' : 's'}.`
            : `${firstName} has no upcoming appointments.`}
${patient.hasJoinableConsultation ? 'One consultation can be joined right now - offer that first if they sound like they are trying to reach their doctor.' : ''}
Open with one short greeting using their first name, asking what they need.`
}
