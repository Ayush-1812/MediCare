'use server'

import { getSessionId } from '@/lib/auth'

/**
 * ICE server configuration for the consultation's peer connection.
 *
 * Served from a server action rather than `NEXT_PUBLIC_*` on purpose: public env vars are
 * inlined into the JavaScript bundle that every visitor downloads, so TURN credentials
 * placed there would be handed to anyone who loads the site. Here they only reach a
 * signed-in doctor or patient.
 */

export type IceConfig = {
    iceServers: RTCIceServer[]
    /** True when a relay is configured — without one, some networks simply cannot connect. */
    hasTurn: boolean
}

const DEFAULT_STUN = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
]

function splitList(value: string | undefined): string[] {
    return (value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
}

export async function getIceServers(): Promise<IceConfig> {
    // Any signed-in party may ask; the room itself is authorized separately at the socket.
    const doctorId = await getSessionId('doctor')
    const userId = await getSessionId('user')
    if (!doctorId && !userId) return { iceServers: [], hasTurn: false }

    const stunUrls = splitList(process.env.STUN_URLS)
    const iceServers: RTCIceServer[] = [
        { urls: stunUrls.length > 0 ? stunUrls : DEFAULT_STUN },
    ]

    const turnUrls = splitList(process.env.TURN_URLS)
    const username = process.env.TURN_USERNAME
    const credential = process.env.TURN_CREDENTIAL

    // A TURN entry without credentials is worse than none: the browser keeps trying it and
    // the failure surfaces late, as a connection that just never establishes.
    if (turnUrls.length > 0 && username && credential) {
        iceServers.push({ urls: turnUrls, username, credential })
        return { iceServers, hasTurn: true }
    }

    if (turnUrls.length > 0) {
        console.warn(
            '[webrtc] TURN_URLS is set but TURN_USERNAME/TURN_CREDENTIAL are missing — ' +
            'ignoring TURN. Calls will fail on networks that need a relay.',
        )
    }

    return { iceServers, hasTurn: false }
}
