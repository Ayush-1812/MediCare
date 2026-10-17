/**
 * Function declarations handed to Gemini Live.
 *
 * Each maps onto business logic that already exists in `src/app/actions/` — nothing here
 * re-derives availability, re-checks a slot or re-implements authorization.
 *
 * TERSE ON PURPOSE. These declarations are sent to the model as context on every turn,
 * alongside the system prompt. An earlier version described each tool at length — when to
 * call it, when not to, what to say afterwards — and measured against the live provider
 * that put roughly 9,000 prompt tokens on every single turn (usageMetadata, VOICE_TRACE=1).
 * Most of that prose repeated rules the system prompt already states: dosages read
 * exactly, emergencies escalated, no refunds promised, only the doctor opens the room.
 * Saying them twice cost latency on every reply and bought nothing.
 *
 * So a description here says WHAT the tool does and any input semantics that are not
 * obvious from the schema. HOW to behave lives in `prompt.ts`, once. If you are tempted to
 * add a behavioural rule to a description, add it to the system prompt instead.
 *
 * Two contracts the test suite enforces, worth keeping in mind when editing:
 *   · the three `propose_*` descriptions must say they change nothing
 *   · no tool may accept an identity, a query string, a URL or a path
 */

import { Behavior, Type, type FunctionDeclaration } from '@google/genai'
import { FAQ_TOPICS } from '@/lib/faq'

const LIMIT = (fallback: number) => ({ type: Type.NUMBER, description: `1-5, default ${fallback}.` })
const SLOT_DATE = { type: Type.STRING, description: 'slotDateKey from get_doctor_availability.' }
const SLOT_TIME = { type: Type.STRING, description: 'Exactly as returned, e.g. "05:30 PM".' }

export const VOICE_TOOLS: FunctionDeclaration[] = [
    // ── The patient's own record ─────────────────────────────────────────
    {
        name: 'get_my_profile',
        description: "The patient's profile: contact details, height, weight, blood group, allergies.",
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'list_my_appointments',
        description: "The patient's appointments: doctor, date, time, fee, paid, status, joinable now.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                status: { type: Type.STRING, enum: ['upcoming', 'past', 'cancelled', 'all'] },
                limit: LIMIT(3),
            },
        },
    },
    {
        name: 'list_my_prescriptions',
        description: "The patient's saved prescriptions: medicines, doses, notes.",
        parameters: { type: Type.OBJECT, properties: { limit: LIMIT(2) } },
    },
    {
        name: 'explain_prescription',
        description: 'One saved prescription with its scanned contents and scan confidence.',
        parameters: {
            type: Type.OBJECT,
            properties: { prescriptionId: { type: Type.STRING } },
            required: ['prescriptionId'],
        },
    },
    {
        name: 'get_health_summary',
        description: 'BMI, blood group, allergies and the latest completed consultation.',
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'get_consultation_summary',
        description: "A past consultation's diagnosis, prescription and follow-up date.",
        parameters: {
            type: Type.OBJECT,
            properties: { appointmentId: { type: Type.STRING } },
            required: ['appointmentId'],
        },
    },
    {
        name: 'get_consultation_status',
        description: 'Whether a video consultation can be joined now, and if not, why.',
        parameters: {
            type: Type.OBJECT,
            properties: { appointmentId: { type: Type.STRING } },
            required: ['appointmentId'],
        },
    },
    {
        name: 'get_payment_status',
        description: 'Whether one appointment is paid, and the amount.',
        parameters: {
            type: Type.OBJECT,
            properties: { appointmentId: { type: Type.STRING } },
            required: ['appointmentId'],
        },
    },

    // ── Doctors ──────────────────────────────────────────────────────────
    {
        name: 'search_doctors',
        description: 'Find bookable doctors. All filters optional and loosely matched.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                speciality: { type: Type.STRING, description: 'As the patient said it.' },
                city: { type: Type.STRING },
                name: { type: Type.STRING },
                language: { type: Type.STRING },
                maxFee: { type: Type.NUMBER, description: 'Rupees.' },
                limit: LIMIT(3),
            },
        },
    },
    {
        name: 'get_doctor_profile',
        description: "One doctor's public profile, fee and languages (often not recorded).",
        parameters: {
            type: Type.OBJECT,
            properties: { doctorId: { type: Type.STRING }, doctorName: { type: Type.STRING } },
        },
    },
    {
        name: 'get_doctor_availability',
        description: "One doctor's open slots for the next 7 days, and fee.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                doctorId: { type: Type.STRING },
                doctorName: { type: Type.STRING },
                date: { type: Type.STRING, description: 'Optional, YYYY-MM-DD.' },
            },
        },
    },

    // ── Changes: propose, then confirm ───────────────────────────────────
    {
        name: 'propose_booking',
        description: 'Prepare a booking to read back. This does not book anything.',
        parameters: {
            type: Type.OBJECT,
            properties: { doctorId: { type: Type.STRING }, slotDate: SLOT_DATE, slotTime: SLOT_TIME },
            required: ['doctorId', 'slotDate', 'slotTime'],
        },
    },
    {
        name: 'propose_cancellation',
        description: 'Prepare a cancellation to read back. This does not cancel anything.',
        parameters: {
            type: Type.OBJECT,
            properties: { appointmentId: { type: Type.STRING } },
            required: ['appointmentId'],
        },
    },
    {
        name: 'propose_reschedule',
        description: 'Prepare moving an appointment to another slot, same doctor. This does not change anything.',
        parameters: {
            type: Type.OBJECT,
            properties: { appointmentId: { type: Type.STRING }, slotDate: SLOT_DATE, slotTime: SLOT_TIME },
            required: ['appointmentId', 'slotDate', 'slotTime'],
        },
    },
    {
        name: 'confirm_action',
        description: 'Commit the last proposal after a clear yes. Its details were stored when proposed.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                action: {
                    type: Type.STRING,
                    enum: ['book', 'cancel', 'reschedule'],
                    description: 'What you believe you are confirming.',
                },
            },
        },
    },
    {
        name: 'cancel_pending_action',
        description: 'Discard the last proposal.',
        parameters: { type: Type.OBJECT, properties: {} },
    },

    // ── Everything else ──────────────────────────────────────────────────
    {
        name: 'assess_symptoms',
        description: 'Severity triage of described symptoms. Call whenever they describe feeling unwell.',
        parameters: {
            type: Type.OBJECT,
            properties: { description: { type: Type.STRING } },
            required: ['description'],
        },
    },
    {
        name: 'find_nearby_pharmacies',
        description: 'Pharmacies near the patient. Needs location consent from the panel.',
        parameters: { type: Type.OBJECT, properties: { limit: LIMIT(3) } },
    },
    {
        name: 'answer_faq',
        description: "MediCare's published answer to a common question.",
        parameters: {
            type: Type.OBJECT,
            properties: { topic: { type: Type.STRING, enum: FAQ_TOPICS } },
            required: ['topic'],
        },
    },
    {
        name: 'get_support_contact',
        description: 'Open the contact page. There is no ticket system.',
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'navigate',
        description: 'Open a page for anything voice cannot do: paying, uploading, joining a call, signing in.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                destination: {
                    type: Type.STRING,
                    enum: [
                        'doctors',
                        'my_appointments',
                        'my_profile',
                        'prescriptions',
                        'new_prescription',
                        'pharmacies',
                        'ai_assistant',
                        'doctor_profile',
                        'video_call',
                        'login',
                        'contact',
                    ],
                },
                doctorId: { type: Type.STRING, description: 'For doctor_profile.' },
                appointmentId: { type: Type.STRING, description: 'For video_call.' },
                reason: { type: Type.STRING },
            },
            required: ['destination'],
        },
    },
]

/**
 * Every lookup is BLOCKING.
 *
 * Without this, tool behaviour is unspecified, and a non-blocking call's result defaults
 * to `WHEN_IDLE` scheduling: "add the result to the context and generate output without
 * interrupting ongoing generation" — i.e. only once the model is idle. A live microphone
 * never lets it go idle, because audio keeps streaming even through silence, so the user
 * always looks active. The result sat in context until the patient's NEXT utterance ended,
 * and every answer came out one turn late: ask about dermatologists, hear the answer to
 * the previous question.
 *
 * It never appeared in the text-driven tests, because a text turn sent with
 * `turnComplete: true` makes the model idle instantly. Only streaming real audio — which
 * scripts/verify-voice-session.ts does — exposed it.
 */
const TOOL_BEHAVIOR = process.env.VOICE_TOOL_BEHAVIOR ?? 'BLOCKING'
for (const tool of VOICE_TOOLS) {
    if (TOOL_BEHAVIOR === 'BLOCKING') tool.behavior = Behavior.BLOCKING
    else if (TOOL_BEHAVIOR === 'NON_BLOCKING') tool.behavior = Behavior.NON_BLOCKING
    // 'UNSET' leaves the field off entirely, which is the provider default.
}

/** Short UI labels, so the "thinking" state can say what it is actually doing. */
export const TOOL_LABELS: Record<string, string> = {
    get_my_profile: 'Looking up your profile',
    list_my_appointments: 'Checking your appointments',
    list_my_prescriptions: 'Fetching your prescriptions',
    explain_prescription: 'Reading that prescription',
    get_health_summary: 'Reviewing your health record',
    get_consultation_summary: 'Opening that consultation',
    get_consultation_status: 'Checking your consultation',
    get_payment_status: 'Checking the payment',
    search_doctors: 'Searching for doctors',
    get_doctor_profile: 'Opening that profile',
    get_doctor_availability: 'Checking available slots',
    propose_booking: 'Preparing the booking',
    propose_cancellation: 'Preparing the cancellation',
    propose_reschedule: 'Preparing the change',
    confirm_action: 'Confirming',
    cancel_pending_action: 'Cancelling that',
    assess_symptoms: 'Reviewing your symptoms',
    find_nearby_pharmacies: 'Finding nearby pharmacies',
    answer_faq: 'Looking that up',
    get_support_contact: 'Opening contact details',
    navigate: 'Opening the page',
}

export const TOOL_NAMES = VOICE_TOOLS.map((t) => t.name as string)

/**
 * Tools whose effects are visible outside this conversation.
 *
 * `propose_*` change nothing, so they are ordinary reads. The single mutating entry point
 * is `confirm_action`, which carries no details of its own — the gateway commits what the
 * pending-action store holds.
 */
export const MUTATING_TOOLS = new Set<string>(['confirm_action'])

/** Answered by the gateway itself, because they operate on the per-session pending store. */
export const GATEWAY_TOOLS = new Set<string>(['confirm_action', 'cancel_pending_action'])
