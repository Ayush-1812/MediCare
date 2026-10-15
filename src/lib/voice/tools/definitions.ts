/**
 * Function declarations handed to Gemini Live.
 *
 * These are deliberately thin: each one maps onto business logic that already exists in
 * `src/app/actions/`. Nothing here re-derives availability, re-checks a slot or
 * re-implements authorization — the executor calls the same server actions the web UI
 * calls, so there is exactly one source of truth per behaviour.
 *
 * Descriptions are written for the model, not for a developer. They say when *not* to
 * call a tool as well as when to, because the common failure in a voice agent is calling
 * a data tool for a question that was really small talk, which costs a round trip the
 * user hears as a pause.
 *
 * Phase 2 ships read-only tools plus guided navigation. Mutating tools (book, cancel,
 * reschedule, delete) arrive with the spoken confirmation protocol — the executor's
 * idempotency plumbing is already in place for them, see `execute.ts`.
 */

import { Type, type FunctionDeclaration } from '@google/genai'

export const VOICE_TOOLS: FunctionDeclaration[] = [
    {
        name: 'get_my_profile',
        description:
            "Returns the signed-in patient's own profile: name, phone, gender, date of " +
            'birth, address, and health details (height, weight, blood group, allergies). ' +
            'Call this when the patient asks what MediCare has on file about them, or when ' +
            'you need their details to fill something in. Do not call it to greet them — ' +
            'their name is already in your session context.',
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'list_my_appointments',
        description:
            "Lists the patient's own appointments with doctor name, speciality, date, time, " +
            'fee, payment status and whether each is upcoming, completed or cancelled. Use ' +
            'for "what do I have booked", "when is my appointment", or before discussing a ' +
            'specific visit. Returns a summary count plus the most relevant few — never the ' +
            'whole history — because a spoken list longer than about three items is unusable.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                status: {
                    type: Type.STRING,
                    enum: ['upcoming', 'past', 'cancelled', 'all'],
                    description: 'Which appointments to return. Defaults to upcoming.',
                },
                limit: {
                    type: Type.NUMBER,
                    description: 'Maximum to return, 1-5. Defaults to 3.',
                },
            },
        },
    },
    {
        name: 'search_doctors',
        description:
            'Searches bookable doctors by speciality, city, name, spoken language or maximum ' +
            'fee. Only returns doctors who have completed their profile and are accepting ' +
            'bookings. Use when the patient wants to find or compare doctors. Speciality is ' +
            'free text in this database, so pass what the patient said and let the search ' +
            'match loosely — do not invent a canonical speciality name.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                speciality: {
                    type: Type.STRING,
                    description: 'e.g. "dermatologist", "skin", "child doctor".',
                },
                city: { type: Type.STRING, description: 'City to filter by.' },
                name: { type: Type.STRING, description: 'Full or partial doctor name.' },
                language: {
                    type: Type.STRING,
                    description: 'A language the doctor should speak, e.g. "Hindi".',
                },
                maxFee: {
                    type: Type.NUMBER,
                    description: 'Maximum consultation fee in rupees.',
                },
                limit: { type: Type.NUMBER, description: 'Maximum to return, 1-5. Defaults to 3.' },
            },
        },
    },
    {
        name: 'get_doctor_availability',
        description:
            'Returns the open consultation slots for one doctor over the next 7 days, along ' +
            'with their fee. Call this before suggesting any time to the patient. Slot times ' +
            'come back exactly as the system stores them (for example "02:30 PM") — read them ' +
            'to the patient naturally, but never alter the string, because booking matches on it.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                doctorId: {
                    type: Type.STRING,
                    description: 'Preferred. The id returned by search_doctors.',
                },
                doctorName: {
                    type: Type.STRING,
                    description: 'Use only when you do not have the id. Matched loosely.',
                },
                date: {
                    type: Type.STRING,
                    description:
                        'Optional single day to narrow to, as YYYY-MM-DD. Omit to get all open days.',
                },
            },
        },
    },
    {
        name: 'list_my_prescriptions',
        description:
            "Lists the patient's saved prescriptions with their medicines, dosages and notes. " +
            'Read dosages back exactly as returned — never round, convert or paraphrase a ' +
            'dose, and never infer a medicine that is not in the data.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                limit: { type: Type.NUMBER, description: 'Maximum to return, 1-5. Defaults to 2.' },
            },
        },
    },
    {
        name: 'get_health_summary',
        description:
            "Returns what MediCare holds on the patient's health: BMI (only when both height " +
            'and weight are on file), blood group, allergies, and their most recent completed ' +
            'consultation. MediCare does not compute any numeric health score — if the patient ' +
            'asks for one, say it does not exist rather than producing a number.',
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'assess_symptoms',
        description:
            'Classifies described symptoms for severity and extracts structured detail ' +
            '(duration, onset, body location). Call this whenever the patient describes how ' +
            'they feel physically. If it returns severity EMERGENCY you must stop everything ' +
            'else, tell them plainly to seek emergency care now, and not continue with ' +
            'booking or any other task. This tool does not diagnose and neither should you.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                description: {
                    type: Type.STRING,
                    description: "The patient's own words about their symptoms.",
                },
            },
            required: ['description'],
        },
    },
    {
        name: 'get_consultation_summary',
        description:
            'Returns the written outcome of one past consultation: diagnosis, the prescription ' +
            'the doctor wrote, and any follow-up date. The doctor\'s private notes are never ' +
            'included for a patient and must never be guessed at.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                appointmentId: {
                    type: Type.STRING,
                    description: 'From list_my_appointments.',
                },
            },
            required: ['appointmentId'],
        },
    },
    {
        name: 'navigate',
        description:
            'Moves the patient to a page in the app. Use this for anything you cannot do for ' +
            'them by voice — paying for an appointment, uploading a prescription photo, ' +
            'joining a video consultation, signing in. Say what you are opening and why ' +
            'before calling it; the page changes under them immediately.',
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
                    description: 'Which page to open.',
                },
                doctorId: {
                    type: Type.STRING,
                    description: 'Required for destination "doctor_profile".',
                },
                appointmentId: {
                    type: Type.STRING,
                    description: 'Required for destination "video_call".',
                },
                reason: {
                    type: Type.STRING,
                    description: 'One short phrase shown in the transcript, e.g. "to pay for your booking".',
                },
            },
            required: ['destination'],
        },
    },
]

/** Short UI labels, so the "thinking" state can say what it is actually doing. */
export const TOOL_LABELS: Record<string, string> = {
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

export const TOOL_NAMES = VOICE_TOOLS.map((t) => t.name as string)

/**
 * Tools whose effects are visible outside this conversation. Empty in Phase 2 — every
 * tool above is a read or a client-side navigation. The executor still routes through
 * the idempotency path so that adding `book_appointment` here is a one-line change
 * rather than a redesign.
 */
export const MUTATING_TOOLS = new Set<string>([])
