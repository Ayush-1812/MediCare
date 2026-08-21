import nodemailer, { type Transporter } from 'nodemailer'

/**
 * SMTP delivery for transactional mail (appointment confirmations).
 *
 * Everything here is deliberately non-throwing. Mail is a *notification*, not part of the
 * booking itself — a mistyped SMTP password must never turn a successful booking into an
 * error the patient sees, and must never roll anything back. Failures are logged and
 * reported through the return value instead.
 */

export type MailMessage = {
    to: string
    subject: string
    html: string
    text: string
    replyTo?: string
    /** Appears in the log line for every attempt, so a failure can be traced to a booking. */
    context?: string
}

export type MailResult =
    | { sent: true; attempts: number; messageId?: string }
    | { sent: false; attempts: number; reason: string; retryable: boolean }

let cached: Transporter | null = null

/** True when enough SMTP settings exist to even attempt a send. */
export function isMailConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
}

/** The address mail is sent from — falls back to the SMTP account itself. */
export function mailFrom(): string {
    const from = process.env.MAIL_FROM?.trim()
    if (from) return from
    return `MediCare <${process.env.SMTP_USER ?? 'no-reply@medicare.local'}>`
}

function transporter(): Transporter {
    if (cached) return cached

    const port = Number(process.env.SMTP_PORT ?? 587)
    cached = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        // Port 465 is implicit TLS; 587/25 start plaintext and upgrade via STARTTLS.
        // Honour an explicit SMTP_SECURE when set, otherwise derive it from the port.
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
        // Without these a black-holed SMTP host leaves the socket hanging indefinitely,
        // pinning a serverless invocation open until the platform kills it.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
    })

    return cached
}

const MAX_ATTEMPTS = 3
const BACKOFF_MS = [500, 2000]

/**
 * Whether a failed send is worth repeating.
 *
 * SMTP splits failures cleanly: 4xx means "try later" (greylisting, rate limit, busy
 * server) while 5xx is permanent (bad address, 535 auth rejected). Retrying a 5xx just
 * burns time and, for auth failures, risks the provider locking the account. Socket-level
 * errors have no response code at all and are always worth one more go.
 */
function isRetryable(error: unknown): boolean {
    const err = error as { responseCode?: number; code?: string }

    if (typeof err.responseCode === 'number') {
        return err.responseCode >= 400 && err.responseCode < 500
    }

    return ['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ESOCKET', 'EDNS', 'ECONNREFUSED'].includes(
        err.code ?? '',
    )
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
    const label = message.context ? `${message.context} ` : ''

    if (!isMailConfigured()) {
        // Local dev and the docker-compose stack run without SMTP credentials. Log the
        // mail that *would* have gone out so the flow is still verifiable end to end.
        console.warn(
            `[mail] ${label}SKIPPED "${message.subject}" to ${message.to} — SMTP is not configured. ` +
            'Set SMTP_HOST / SMTP_USER / SMTP_PASSWORD and restart the server. ' +
            'Check /api/health/mail to confirm.',
        )
        return { sent: false, attempts: 0, reason: 'SMTP is not configured', retryable: false }
    }

    if (!message.to || !message.to.includes('@')) {
        console.error(`[mail] ${label}FAILED — no usable recipient address ("${message.to}")`)
        return {
            sent: false,
            attempts: 0,
            reason: `No usable recipient address ("${message.to}")`,
            retryable: false,
        }
    }

    let lastError: unknown = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const info = await transporter().sendMail({
                from: mailFrom(),
                to: message.to,
                subject: message.subject,
                text: message.text,
                html: message.html,
                ...(message.replyTo ? { replyTo: message.replyTo } : {}),
            })

            console.log(
                `[mail] ${label}SENT "${message.subject}" to ${message.to}` +
                (attempt > 1 ? ` (attempt ${attempt})` : ''),
            )
            return { sent: true, attempts: attempt, messageId: info?.messageId }
        } catch (error) {
            lastError = error
            const retryable = isRetryable(error)
            const reason = error instanceof Error ? error.message : 'Unknown mail error'

            if (!retryable || attempt === MAX_ATTEMPTS) {
                console.error(
                    `[mail] ${label}FAILED after ${attempt} attempt(s) — "${message.subject}" ` +
                    `to ${message.to}: ${reason}`,
                )
                return { sent: false, attempts: attempt, reason, retryable }
            }

            console.warn(
                `[mail] ${label}attempt ${attempt}/${MAX_ATTEMPTS} failed (${reason}) — retrying…`,
            )
            await delay(BACKOFF_MS[attempt - 1] ?? 2000)
        }
    }

    // Unreachable: the loop always returns. Kept so the function is total.
    const reason = lastError instanceof Error ? lastError.message : 'Unknown mail error'
    return { sent: false, attempts: MAX_ATTEMPTS, reason, retryable: false }
}

/** Absolute base URL used to build "Join video call" links inside emails. */
export function appUrl(): string {
    const configured =
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.APP_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

    return (configured ?? 'http://localhost:3000').replace(/\/+$/, '')
}
