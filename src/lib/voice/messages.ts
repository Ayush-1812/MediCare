/**
 * Source strings for the voice receptionist interface.
 *
 * English is the source of truth. Every other language lives in `i18n.generated.ts`,
 * produced by `scripts/generate-voice-i18n.js` and committed as static data so there is
 * no translation call at runtime.
 *
 * Why the interface is localized at all, when the assistant already speaks the user's
 * language: a Tamil speaker hearing Tamil but reading English buttons is being told, in
 * effect, that their language is a voice feature rather than a supported language. The
 * spoken layer and the written layer have to agree.
 *
 * Keep keys flat and literal. A nested or dynamically-built key cannot be checked for
 * completeness, and a missing translation here is a visibly broken control.
 */

export const MESSAGES = {
    // ── Identity and chrome ──────────────────────────────────────────────
    title: 'Aether',
    subtitle: 'Voice receptionist',
    open_label: 'Open the voice receptionist',
    close_label: 'Close the voice receptionist',
    language_label: 'Language',
    transcript_label: 'Conversation transcript',

    // ── States ───────────────────────────────────────────────────────────
    state_idle: 'Tap to start talking',
    state_connecting: 'Connecting…',
    state_listening: 'Listening',
    state_thinking: 'Thinking…',
    state_speaking: 'Speaking',
    state_reconnecting: 'Reconnecting…',
    state_error: 'Something went wrong',
    mic_muted: 'Microphone muted',

    // ── Controls ─────────────────────────────────────────────────────────
    start_talking: 'Start talking',
    end_call: 'End call',
    mute: 'Mute microphone',
    unmute: 'Unmute microphone',
    stop_speaking: 'Stop the assistant speaking',
    send: 'Send message',
    text_input_label: 'Type a message instead of speaking',
    type_instead: 'Or type instead…',
    type_disabled: 'Start a call to type',

    // ── Empty state ──────────────────────────────────────────────────────
    empty_live: 'Say something — try “what appointments do I have?”',
    empty_idle: 'Start a call, or type a question below.',
    empty_hint:
        'Aether can look up your appointments, doctors, slots and prescriptions. It cannot take payments or give medical advice.',

    // ── Language detection ───────────────────────────────────────────────
    // `{language}` is substituted with the detected language's own name.
    detected_prompt: 'That sounded like {language}. Switch?',
    detected_switch: 'Switch',
    detected_dismiss: 'Not now',
    switching_language: 'Switching language, keeping your conversation…',

    // ── Errors ───────────────────────────────────────────────────────────
    err_mic_denied:
        'Microphone access was blocked. Allow it in your browser’s address bar, then try again — or type your question instead.',
    err_mic_unavailable: 'No microphone was found. You can still type your question.',
    err_mic_in_use:
        'Your microphone is being used by another app or tab. Close it and try again, or type your question.',
    err_consultation_active:
        'You are in a video consultation right now. The assistant cannot use your microphone at the same time.',
    err_unauthorized: 'Please sign in again to use the voice assistant.',
    err_provider_quota: 'The voice service is over its quota right now. Please try again later.',
    err_provider_unavailable: 'The voice service could not be reached.',
    err_session_expired: 'This voice session reached its time limit.',
    err_network: 'The voice connection was lost. Please start again.',
    err_internal: 'Could not start the voice assistant.',

    // ── Tool activity labels ─────────────────────────────────────────────
    tool_get_my_profile: 'Looking up your profile',
    tool_list_my_appointments: 'Checking your appointments',
    tool_search_doctors: 'Searching for doctors',
    tool_get_doctor_availability: 'Checking available slots',
    tool_list_my_prescriptions: 'Fetching your prescriptions',
    tool_get_health_summary: 'Reviewing your health record',
    tool_assess_symptoms: 'Reviewing your symptoms',
    tool_get_consultation_summary: 'Opening that consultation',
    tool_navigate: 'Opening the page',
    tool_fallback: 'Working on that',
} as const

export type MessageKey = keyof typeof MESSAGES
export type MessageCatalog = Record<MessageKey, string>

export const MESSAGE_KEYS = Object.keys(MESSAGES) as MessageKey[]
