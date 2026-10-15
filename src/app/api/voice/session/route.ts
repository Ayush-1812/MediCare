/**
 * Session bootstrap for the voice gateway.
 *
 * The gateway calls this once per session, forwarding the patient's own cookie, and
 * receives everything needed to open a Live connection: the model id, the full
 * `LiveConnectConfig` (system instruction and tool declarations included), and the
 * patient's id.
 *
 * Doing it this way keeps every configuration decision in TypeScript next to the code it
 * describes. The CommonJS gateway holds no prompt text, no tool schema and no model id of
 * its own, so there is nothing there to fall out of step with the app.
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionId } from '@/lib/auth'
import { buildLiveConfig } from '@/lib/voice/liveConfig'
import { DEFAULT_LANGUAGE, VOICE_MODEL, isSupportedLanguage } from '@/lib/voice/config'
import { appointmentStatus, consultationJoinState } from '@/lib/appointment'

export const dynamic = 'force-dynamic'

const INTERNAL_HEADER = 'x-voice-internal'

export async function POST(request: Request) {
    const expected = process.env.VOICE_INTERNAL_SECRET
    if (!expected) {
        return NextResponse.json({ ok: false, error: 'Gateway not running' }, { status: 503 })
    }
    if (request.headers.get(INTERNAL_HEADER) !== expected) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const userId = await getSessionId('user')
    if (!userId) {
        return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 })
    }

    let requested: unknown
    try {
        requested = (await request.json())?.language
    } catch {
        requested = undefined
    }
    const language = isSupportedLanguage(requested) ? requested : DEFAULT_LANGUAGE

    const [user, appointments] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
        // Only what the greeting needs. The agent calls list_my_appointments for anything
        // beyond "do they have something coming up".
        prisma.appointment.findMany({
            where: { userId, cancelled: false, isCompleted: false },
            select: {
                slotDate: true,
                slotTime: true,
                cancelled: true,
                isCompleted: true,
                startTime: true,
                meetingId: true,
            },
        }),
    ])
    if (!user) {
        return NextResponse.json({ ok: false, error: 'User not found' }, { status: 401 })
    }

    const now = new Date()
    const scheduled = appointments.filter((a) => appointmentStatus(a, now) === 'Scheduled')
    const hasJoinableConsultation = scheduled.some((a) => consultationJoinState(a, now).canJoin)

    const config = buildLiveConfig(
        {
            name: user.name,
            upcomingCount: scheduled.length,
            hasJoinableConsultation,
        },
        language,
    )

    return NextResponse.json({
        ok: true,
        userId,
        language,
        model: VOICE_MODEL,
        config,
    })
}
