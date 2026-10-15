/**
 * Custom Node server: Next.js + Socket.IO signaling for WebRTC consultations.
 *
 * Next's own `next start` cannot host a WebSocket server, and WebRTC needs a live channel
 * to trade SDP offers/answers and ICE candidates between the two people on a call. So the
 * app boots through this file instead.
 *
 * Media never touches this server — it flows peer-to-peer (or via TURN). All that passes
 * through here is signaling: a few hundred bytes per call to introduce the two browsers.
 *
 * Written in CommonJS on purpose: it runs before/outside Next's build pipeline, so it
 * cannot import the app's TypeScript modules. The small amount of auth logic it needs is
 * reimplemented here against the same cookie names and JWT claims as `src/lib/auth.ts`.
 */

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const { parseCookies, sessionId, USER_COOKIE, DOCTOR_COOKIE } = require('./server/lib/session')
const { attachVoiceGateway } = require('./server/voice/gateway')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = Number(process.env.PORT || 3000)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()
const prisma = new PrismaClient()

// Cookie parsing and JWT verification moved to ./server/lib/session.js, which mirrors
// src/lib/auth.ts. The voice gateway needs exactly the same checks, and one mirror of
// lib/auth.ts is better than two.

/**
 * Shared secret proving an internal request came from this process.
 *
 * The voice gateway cannot call server actions directly — they resolve identity through
 * `cookies()` and need a Next request scope — so it posts to internal API routes instead.
 * Because Next is embedded in this very process, both sides read the same value from
 * `process.env` and it never leaves the process or reaches a browser. Generated per boot:
 * nothing persists it, so there is nothing to leak or rotate.
 *
 * Set before `app.prepare()` so the value is in place no matter when the first request
 * arrives.
 */
process.env.VOICE_INTERNAL_SECRET =
    process.env.VOICE_INTERNAL_SECRET || crypto.randomBytes(32).toString('hex')

/**
 * Decides whether this socket may join this appointment's room.
 *
 * This is the only thing standing between a consultation and anyone who guesses an
 * appointment id, so it is checked here at connect time rather than trusted from
 * the client.
 */
async function authorize(handshake) {
    const appointmentId = handshake.auth && handshake.auth.appointmentId
    if (!appointmentId || typeof appointmentId !== 'string') {
        return { error: 'No appointment specified' }
    }

    const jar = parseCookies(handshake.headers.cookie)
    const doctorId = sessionId(jar, DOCTOR_COOKIE, 'doctor')
    const userId = sessionId(jar, USER_COOKIE, 'user')
    if (!doctorId && !userId) return { error: 'Not signed in' }

    const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true, docId: true, userId: true, cancelled: true, isCompleted: true },
    })
    if (!appointment) return { error: 'Appointment not found' }
    if (appointment.cancelled) return { error: 'This appointment was cancelled' }
    if (appointment.isCompleted) return { error: 'This consultation has already ended' }

    const isDoctor = Boolean(doctorId) && appointment.docId === doctorId
    const isPatient = Boolean(userId) && appointment.userId === userId
    if (!isDoctor && !isPatient) return { error: 'You are not part of this consultation' }

    // `identityId` is carried so the connection handler can tag the socket with who owns
    // it. The voice gateway reads that tag to refuse opening a microphone while this same
    // person is sitting in a consultation — two things cannot own the mic at once.
    return {
        appointmentId,
        role: isDoctor ? 'doctor' : 'patient',
        identityId: isDoctor ? doctorId : userId,
    }
}

app.prepare().then(async () => {
    const server = createServer((req, res) => {
        handle(req, res, parse(req.url, true))
    })

    const io = new Server(server, {
        path: '/api/socket',
        // Signaling payloads are tiny; refuse anything that clearly is not one.
        maxHttpBufferSize: 1e6,
    })

    // Redis fans room events out across instances. Without it Socket.IO keeps rooms in the
    // process's own memory, which is correct for a single container but silently drops
    // signals the moment a second instance exists — the two peers would land on different
    // processes and never see each other.
    if (process.env.REDIS_URL) {
        try {
            const Redis = require('ioredis')
            const { createAdapter } = require('@socket.io/redis-adapter')
            const pubClient = new Redis(process.env.REDIS_URL, { lazyConnect: true })
            const subClient = pubClient.duplicate()
            await Promise.all([pubClient.connect(), subClient.connect()])
            io.adapter(createAdapter(pubClient, subClient))
            console.log('[signaling] Redis adapter attached — signaling works across instances')
        } catch (error) {
            // A missing Redis must not take the whole app down; single-instance still works.
            console.error(
                '[signaling] Redis adapter failed, falling back to in-memory rooms ' +
                '(fine for one instance, broken across several):',
                error.message,
            )
        }
    } else {
        console.log('[signaling] REDIS_URL not set — using in-memory rooms (single instance only)')
    }

    io.use(async (socket, nextFn) => {
        try {
            const result = await authorize(socket.handshake)
            if (result.error) return nextFn(new Error(result.error))
            socket.data.appointmentId = result.appointmentId
            socket.data.role = result.role
            socket.data.userId = result.identityId
            nextFn()
        } catch (error) {
            console.error('[signaling] authorization threw:', error)
            nextFn(new Error('Could not verify this consultation'))
        }
    })

    io.on('connection', async (socket) => {
        const room = socket.data.appointmentId
        const role = socket.data.role

        // A room holds one doctor slot and one patient slot — never more, since `role` is
        // derived from `docId`/`userId` and only one account can ever match each. Counting
        // raw sockets instead of slots was the wrong model: a network blip that leaves a
        // stale connection lingering for a few seconds, or simply opening a second tab,
        // filled the room's "capacity" without actually occupying the other person's slot —
        // so a genuinely new participant, or even the real patient behind a doctor's own
        // duplicate tab, got refused as "room full". Evicting the older socket in the same
        // slot instead means the newest connection for an identity always wins, and the
        // room can never be blocked by that identity's own stale state.
        const existing = await io.in(room).fetchSockets()
        const stale = existing.filter((s) => s.id !== socket.id && s.data.role === role)
        for (const staleSocket of stale) {
            staleSocket.emit('replaced')
            staleSocket.disconnect(true)
        }

        socket.join(room)
        const others = existing.filter((s) => s.id !== socket.id && s.data.role !== role)
        console.log(`[signaling] ${role} joined ${room} (${others.length + 1} in room)`)

        // Tell the newcomer whether someone is already waiting, and tell the other side
        // that a peer appeared. The doctor uses this to decide when to make the offer.
        socket.emit('joined', { role, peerPresent: others.length > 0 })
        socket.to(room).emit('peer-joined', { role })

        // Pure relay: the server never inspects or stores SDP or ICE payloads.
        socket.on('signal', (payload) => {
            socket.to(room).emit('signal', payload)
        })

        // The doctor has submitted the write-up and closed the consultation. This is not
        // the same as 'leave' (which just means one side stepped out and could come back):
        // the appointment is now completed, so the other side must be moved to the report
        // rather than left sitting in a room that no longer exists. Relayed in real time
        // because the alternative — waiting for the patient's next poll — leaves them
        // staring at a frozen call for several seconds.
        socket.on('consultation-ended', () => {
            socket.to(room).emit('consultation-ended', { role })
        })

        socket.on('leave', () => {
            socket.to(room).emit('peer-left', { role })
            socket.leave(room)
        })

        socket.on('disconnect', () => {
            socket.to(room).emit('peer-left', { role })
            console.log(`[signaling] ${role} left ${room}`)
        })
    })

    // The voice receptionist takes its own namespace on this same Socket.IO server, so it
    // inherits the transport, the Redis adapter when one is configured, and the payload
    // cap above. It disables itself with a warning if GEMINI_API_KEY is absent rather than
    // preventing the app from booting.
    attachVoiceGateway(io, {
        // Loopback: the gateway and Next are the same process, so this never leaves the
        // machine. 127.0.0.1 rather than `hostname`, which is 0.0.0.0 by default and is a
        // bind address, not a dialable one.
        baseUrl: `http://127.0.0.1:${port}`,
        internalSecret: process.env.VOICE_INTERNAL_SECRET,
    })

    server.listen(port, hostname, () => {
        console.log(`▲ MediCare ready on http://${hostname}:${port}`)
        console.log(`[signaling] Socket.IO listening on /api/socket`)
    })
})
