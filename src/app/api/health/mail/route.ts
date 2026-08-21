import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { appUrl, isMailConfigured, mailFrom } from '@/lib/mail/mailer'

/**
 * GET /api/health/mail
 *
 * Diagnostic endpoint — reports whether appointment confirmation emails can be sent,
 * and authenticates against the SMTP server without delivering anything.
 *
 * Never exposes SMTP_PASSWORD; it is reported only as present/absent plus its length,
 * which is enough to spot the usual mistake of pasting an account password (any length)
 * where Gmail wants a 16-character App Password.
 */
export async function GET() {
    const password = process.env.SMTP_PASSWORD ?? ''

    const config = {
        SMTP_HOST: process.env.SMTP_HOST ?? null,
        SMTP_PORT: process.env.SMTP_PORT ?? '587 (default)',
        SMTP_SECURE: process.env.SMTP_SECURE ?? 'derived from port',
        SMTP_USER: process.env.SMTP_USER ?? null,
        SMTP_PASSWORD: password ? `present (${password.replace(/\s/g, '').length} chars)` : null,
        MAIL_FROM: mailFrom(),
        appUrl: appUrl(),
    }

    const missing = (['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'] as const).filter(
        (key) => !process.env[key],
    )

    if (!isMailConfigured()) {
        return NextResponse.json(
            {
                success: false,
                configured: false,
                missing,
                config,
                hint:
                    'Bookings still succeed, but no confirmation emails are sent. Add the missing ' +
                    'keys to .env and restart the dev server — a running server does not pick up ' +
                    'new env vars on its own.',
                timestamp: new Date().toISOString(),
            },
            { status: 503 },
        )
    }

    const port = Number(process.env.SMTP_PORT ?? 587)
    const startedAt = Date.now()

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port,
            secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
        })

        await transporter.verify()

        return NextResponse.json({
            success: true,
            configured: true,
            authenticated: true,
            latencyMs: Date.now() - startedAt,
            config,
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        const err = error as { code?: string; responseCode?: number; message?: string }
        console.error('[GET /api/health/mail] SMTP verify failed:', err.message)

        return NextResponse.json(
            {
                success: false,
                configured: true,
                authenticated: false,
                latencyMs: Date.now() - startedAt,
                config,
                errorCode: err.code ?? 'UNKNOWN',
                responseCode: err.responseCode ?? null,
                providerMessage: err.message ?? 'Unknown SMTP error',
                timestamp: new Date().toISOString(),
            },
            { status: 503 },
        )
    }
}
