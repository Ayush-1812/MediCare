import { appUrl, sendMail, type MailResult } from './mailer'
import { JOIN_WINDOW_MINUTES, formatSlotDate, parseSlotDateTime } from '@/lib/appointment'
import { DEFAULT_SLOT_DURATION } from '@/lib/schedule'
import { formatINR } from '@/lib/currency'

/**
 * The two emails that go out the moment an appointment is booked:
 *
 *  - the patient gets the doctor's details plus a timeline of what happens next;
 *  - the doctor gets the patient's details for the same slot.
 *
 * Both carry the direct link into the consultation room so neither side has to hunt for it.
 */

export type AppointmentEmailParty = {
    name?: string | null
    email?: string | null
    phone?: string | null
    gender?: string | null
    dob?: string | null
}

export type AppointmentEmailDoctor = AppointmentEmailParty & {
    speciality?: string | null
    degree?: string | null
    experience?: string | null
    hospital?: string | null
    city?: string | null
    address?: { line1?: string; line2?: string } | null
}

export type AppointmentEmailData = {
    appointmentId: string
    slotDate: string
    slotTime: string
    amount: number
    patient: AppointmentEmailParty
    doctor: AppointmentEmailDoctor
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

/** Names, addresses and specialities are user-supplied — never interpolate them raw. */
function esc(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

const UNSET = new Set(['', 'not selected', '0000000000', 'null', 'undefined'])

/** Placeholder profile values ("Not Selected", the unset phone number) should read as blank. */
function clean(value?: string | null): string {
    const text = String(value ?? '').trim()
    return UNSET.has(text.toLowerCase()) ? '' : text
}

function formatClock(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function addressLine(address?: { line1?: string; line2?: string } | null): string {
    if (!address) return ''
    return [clean(address.line1), clean(address.line2)].filter(Boolean).join(', ')
}

// ─── Shared layout ───────────────────────────────────────────────────────────

type Row = { label: string; value: string }

function rowsTable(rows: Row[]): string {
    const cells = rows
        .filter((row) => Boolean(clean(row.value)))
        .map(
            (row) => `
        <tr>
          <td style="padding:9px 0;color:#64748b;font-size:13px;width:42%;vertical-align:top;">${esc(row.label)}</td>
          <td style="padding:9px 0;color:#0f172a;font-size:14px;font-weight:600;">${esc(row.value)}</td>
        </tr>`,
        )
        .join('')

    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${cells}</table>`
}

function timelineList(items: { time: string; label: string }[]): string {
    return items
        .map(
            (item) => `
      <tr>
        <td style="padding:8px 12px 8px 0;color:#2563eb;font-size:13px;font-weight:700;white-space:nowrap;vertical-align:top;">${esc(item.time)}</td>
        <td style="padding:8px 0;color:#334155;font-size:14px;">${esc(item.label)}</td>
      </tr>`,
        )
        .join('')
}

function layout(options: {
    heading: string
    intro: string
    accent: string
    sections: string
    ctaLabel: string
    ctaUrl: string
    footnote: string
}): string {
    return `<!doctype html>
<html>
  <body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:${options.accent};padding:28px 32px;">
              <p style="margin:0 0 6px;color:rgba(255,255,255,0.82);font-size:12px;letter-spacing:1.6px;text-transform:uppercase;font-weight:700;">MediCare</p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">${esc(options.heading)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">${options.intro}</p>
            </td>
          </tr>
          ${options.sections}
          <tr>
            <td style="padding:22px 32px 32px;">
              <a href="${esc(options.ctaUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:10px;font-size:15px;font-weight:600;">${esc(options.ctaLabel)}</a>
              <p style="margin:14px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">${options.footnote}</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">This is an automated message from MediCare. Please do not reply to this address.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

function section(title: string, body: string): string {
    return `
  <tr>
    <td style="padding:18px 32px 0;">
      <p style="margin:0 0 6px;color:#0f172a;font-size:13px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">${esc(title)}</p>
      <div style="border-top:1px solid #e2e8f0;padding-top:6px;">${body}</div>
    </td>
  </tr>`
}

/** Plain-text alternative — some clients (and most spam filters) want one. */
function textVersion(heading: string, lines: string[], ctaUrl: string): string {
    return [heading, '', ...lines, '', `Join the consultation: ${ctaUrl}`, '', '— MediCare'].join('\n')
}

// ─── Timeline ────────────────────────────────────────────────────────────────

function buildTimeline(data: AppointmentEmailData) {
    const slot = parseSlotDateTime(data.slotDate, data.slotTime)
    const dateLabel = formatSlotDate(data.slotDate)

    if (!slot) {
        return {
            dateLabel,
            items: [
                { time: 'Now', label: 'Appointment confirmed' },
                { time: data.slotTime, label: 'Video consultation begins' },
            ],
        }
    }

    const opens = new Date(slot.getTime() - JOIN_WINDOW_MINUTES * 60 * 1000)
    const ends = new Date(slot.getTime() + DEFAULT_SLOT_DURATION * 60 * 1000)

    return {
        dateLabel,
        items: [
            { time: 'Now', label: 'Appointment confirmed and the slot is held' },
            { time: formatClock(opens), label: `Consultation room opens (${JOIN_WINDOW_MINUTES} min early)` },
            { time: formatClock(slot), label: `Video consultation starts on ${dateLabel}` },
            { time: `~${formatClock(ends)}`, label: `Expected to wrap up (${DEFAULT_SLOT_DURATION} min slot)` },
        ],
    }
}

// ─── The two messages ────────────────────────────────────────────────────────

function patientEmail(data: AppointmentEmailData) {
    const joinUrl = `${appUrl()}/video-call/${data.appointmentId}`
    const { dateLabel, items } = buildTimeline(data)
    const doctorName = clean(data.doctor.name) || 'your doctor'

    const doctorRows = rowsTable([
        { label: 'Doctor', value: doctorName },
        { label: 'Speciality', value: clean(data.doctor.speciality) },
        { label: 'Qualification', value: clean(data.doctor.degree) },
        { label: 'Experience', value: clean(data.doctor.experience) },
        { label: 'Clinic / Hospital', value: clean(data.doctor.hospital) },
        {
            label: 'Location',
            value: [clean(data.doctor.city), addressLine(data.doctor.address)].filter(Boolean).join(' — '),
        },
        { label: 'Contact', value: clean(data.doctor.phone) },
        { label: 'Consultation fee', value: formatINR(data.amount) },
    ])

    const appointmentRows = rowsTable([
        { label: 'Date', value: dateLabel },
        { label: 'Time', value: data.slotTime },
        { label: 'Mode', value: 'Video consultation' },
        { label: 'Booking ID', value: data.appointmentId },
    ])

    const sections =
        section('Your appointment', appointmentRows) +
        section('Doctor details', doctorRows) +
        section(
            'What happens next',
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${timelineList(items)}</table>`,
        )

    const html = layout({
        heading: 'Your appointment is confirmed',
        accent: '#2563eb',
        intro: `Hi ${esc(clean(data.patient.name) || 'there')}, your video consultation with <strong>${esc(doctorName)}</strong> on <strong>${esc(dateLabel)} at ${esc(data.slotTime)}</strong> is booked.`,
        sections,
        ctaLabel: 'Join video consultation',
        ctaUrl: joinUrl,
        footnote: `The room opens ${JOIN_WINDOW_MINUTES} minutes before your slot. Sign in to MediCare first, then use the link above or the <strong>Join Video Call</strong> button on My Appointments.`,
    })

    const text = textVersion(
        'Your MediCare appointment is confirmed',
        [
            `Doctor: ${doctorName}${clean(data.doctor.speciality) ? ` (${clean(data.doctor.speciality)})` : ''}`,
            `Date: ${dateLabel}`,
            `Time: ${data.slotTime}`,
            'Mode: Video consultation',
            `Fee: ${formatINR(data.amount)}`,
            `Booking ID: ${data.appointmentId}`,
            '',
            'Timeline:',
            ...items.map((item) => `  ${item.time} — ${item.label}`),
        ],
        joinUrl,
    )

    return {
        subject: `Appointment confirmed — ${doctorName}, ${dateLabel} at ${data.slotTime}`,
        html,
        text,
    }
}

function doctorEmail(data: AppointmentEmailData) {
    const joinUrl = `${appUrl()}/video-call/${data.appointmentId}`
    const { dateLabel, items } = buildTimeline(data)
    const patientName = clean(data.patient.name) || 'A patient'

    const appointmentRows = rowsTable([
        { label: 'Date', value: dateLabel },
        { label: 'Time', value: data.slotTime },
        { label: 'Mode', value: 'Video consultation' },
        { label: 'Fee', value: formatINR(data.amount) },
        { label: 'Booking ID', value: data.appointmentId },
    ])

    const patientRows = rowsTable([
        { label: 'Patient', value: patientName },
        { label: 'Email', value: clean(data.patient.email) },
        { label: 'Phone', value: clean(data.patient.phone) },
        { label: 'Gender', value: clean(data.patient.gender) },
        { label: 'Date of birth', value: clean(data.patient.dob) },
    ])

    const sections =
        section('Appointment', appointmentRows) +
        section('Patient details', patientRows) +
        section(
            'Timeline',
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${timelineList(items)}</table>`,
        )

    const html = layout({
        heading: 'New appointment booked',
        accent: '#0f766e',
        intro: `${esc(clean(data.doctor.name) || 'Doctor')} — <strong>${esc(patientName)}</strong> has booked a video consultation for <strong>${esc(dateLabel)} at ${esc(data.slotTime)}</strong>.`,
        sections,
        ctaLabel: 'Open consultation room',
        ctaUrl: joinUrl,
        footnote:
            'Sign in to the doctor dashboard, then press <strong>Start Video Consultation</strong> to let the patient in.',
    })

    const text = textVersion(
        'New MediCare appointment booked',
        [
            `Patient: ${patientName}`,
            `Email: ${clean(data.patient.email) || '—'}`,
            `Phone: ${clean(data.patient.phone) || '—'}`,
            `Gender: ${clean(data.patient.gender) || '—'}`,
            `Date of birth: ${clean(data.patient.dob) || '—'}`,
            '',
            `Date: ${dateLabel}`,
            `Time: ${data.slotTime}`,
            `Fee: ${formatINR(data.amount)}`,
            `Booking ID: ${data.appointmentId}`,
            '',
            'Timeline:',
            ...items.map((item) => `  ${item.time} — ${item.label}`),
        ],
        joinUrl,
    )

    return {
        subject: `New appointment — ${patientName}, ${dateLabel} at ${data.slotTime}`,
        html,
        text,
    }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Sends both confirmation emails. Never throws: the caller has already committed the
 * booking by the time this runs, so a mail failure is reported, not propagated.
 */
export async function sendAppointmentBookedEmails(
    data: AppointmentEmailData,
): Promise<{ patient: MailResult; doctor: MailResult }> {
    const patientAddress = clean(data.patient.email)
    const doctorAddress = clean(data.doctor.email)
    const context = `[appointment ${data.appointmentId}]`

    const missing = (who: string): MailResult => ({
        sent: false,
        attempts: 0,
        reason: `${who} has no email address`,
        retryable: false,
    })

    const [patient, doctor] = await Promise.all([
        patientAddress
            ? sendMail({ to: patientAddress, context, ...patientEmail(data) })
            : Promise.resolve(missing('Patient')),
        doctorAddress
            ? sendMail({
                  to: doctorAddress,
                  replyTo: patientAddress || undefined,
                  context,
                  ...doctorEmail(data),
              })
            : Promise.resolve(missing('Doctor')),
    ])

    // One summary line per booking, so "did this appointment's emails go out?" is a single
    // grep rather than a hunt through interleaved per-message logs.
    if (patient.sent && doctor.sent) {
        console.log(`[mail] ${context} confirmations sent to patient and doctor`)
    } else {
        console.error(
            `[mail] ${context} INCOMPLETE — patient: ${patient.sent ? 'sent' : patient.reason}` +
            ` | doctor: ${doctor.sent ? 'sent' : doctor.reason}`,
        )
    }

    return { patient, doctor }
}
