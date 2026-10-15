# Voice Receptionist — Setup & Architecture

Everything needed to run, configure and verify the feature. No schema migration is
required: `rescheduleAppointment` writes existing `Appointment` and `Doctor` columns.

---

## 1. Configuration

The voice receptionist reuses the app's existing `GEMINI_API_KEY`. Three optional variables
tune it; all are documented in `.env.example`.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | **yes** | — | Already used by the text assistant. Without it the gateway logs a warning, disables itself, and **the rest of the app boots normally** |
| `VOICE_MODEL` | no | `gemini-3.8-live` | Google rotates Live model ids faster than anything else in the API. Verify with `GET /v1beta/models` and look for `bidiGenerateContent` |
| `VOICE_NAME` | no | `Zephyr` | Prebuilt Live voice. An unrecognised name fails session setup, so the gateway retries once without it and falls back to the model default |
| `VOICE_INTERNAL_SECRET` | no | random per boot | Leave unset. `server.js` generates it before `app.prepare()`, and Next reads it from the same `process.env` because it runs embedded in that process |
| `SERPAPI_KEY` | no | — | Already used by `/api/nearby-pharmacies`. Without it the pharmacy tool says the feature is unconfigured rather than inventing results |

### Running

```bash
npm install
npm run dev          # node server.js — the custom server, not `next dev`
```

`next dev` alone will **not** work: Next cannot host a WebSocket server, and the voice
channel needs one. Look for these lines on boot:

```
[voice] receptionist gateway listening on /voice
[signaling] Socket.IO listening on /api/socket
```

---

## 2. Architecture

```
┌──────────────────────── BROWSER ────────────────────────┐
│ AudioWorklet capture  → 16 kHz mono PCM16               │
│ AudioWorklet playback ← 24 kHz PCM16, flushable         │
│ Panel: transcript · cards · confirm buttons · language  │
└────────────────────────────┬────────────────────────────┘
                             │ Socket.IO namespace /voice
                             │ (path /api/socket, httpOnly cookie)
┌────────────────────────────▼────────────────────────────┐
│ server.js → server/voice/gateway.js                     │
│  · authorizes handshake (JWT + role claim + no active   │
│    consultation)                                        │
│  · owns one Gemini Live session per socket              │
│  · turnId invalidation for barge-in                     │
│  · pending-action store (propose → confirm)             │
│  · injects location after consent                       │
└──────────┬──────────────────────────────┬───────────────┘
           │ WSS bidiGenerateContent      │ localhost HTTP, cookie forwarded
┌──────────▼───────────┐      ┌───────────▼───────────────┐
│ Gemini Live          │      │ Next route handlers       │
│ gemini-3.8-live      │      │  /api/voice/session       │
└──────────────────────┘      │  /api/voice/tool          │
                              │  /api/voice/commit        │
                              │   → existing server       │
                              │     actions → Prisma      │
                              └───────────────────────────┘
```

### Why it is shaped this way

**Transport in `server.js`, logic in Next.** A Next route handler cannot perform a
WebSocket upgrade, so duplex audio rides the Socket.IO server that already exists for
WebRTC signaling. But every server action resolves identity through `cookies()` from
`next/headers` and therefore needs a Next request scope — it cannot be called from the bare
Node server at all. So the gateway forwards the patient's own cookie to internal routes,
where the real actions run under the real session. The cost is one loopback round trip
(~1–3 ms); the benefit is a single source of truth for booking and availability.

**All configuration in TypeScript.** The gateway holds no prompt text, no tool schema and
no model id. It fetches the whole `LiveConnectConfig` from `/api/voice/session` at session
start, so there is nothing in the CommonJS layer to drift out of step with the app.

**Propose → confirm.** The model cannot execute a mutation. `propose_*` validates against
live data and prices from real `Doctor.fees` but changes nothing; the gateway stores the
proposal with a fingerprint over canonical parameters; `confirm_action` takes no parameters
and commits what the store holds. `commitVoiceAction` is never declared to the model.

### Key files

| Path | Role |
|---|---|
| `server/voice/gateway.js` | Live session bridge, barge-in, reconnection, confirmations |
| `server/voice/pendingActions.js` | Pending-action store: fingerprint, TTL, idempotency |
| `server/lib/session.js` | Cookie + JWT helpers shared with the signaling path |
| `src/lib/voice/liveConfig.ts` | The `LiveConnectConfig` the gateway receives |
| `src/lib/voice/prompt.ts` | System instruction, with dates pre-resolved per timezone |
| `src/lib/voice/tools/definitions.ts` | The 21 function declarations the model sees |
| `src/lib/voice/tools/execute.ts` | Read tools + dispatch, onto existing server actions |
| `src/lib/voice/tools/actions.ts` | Proposals and commits for consequential actions |
| `src/lib/voice/untrusted.ts` | Untrusted-content boundary for OCR and third-party text |
| `src/lib/voice/useVoiceSession.ts` | Browser audio graph and state machine |
| `src/components/Voice/VoiceReceptionist.tsx` | Panel |
| `src/components/Voice/VoiceCards.tsx` | Confirmation and result cards |
| `public/voice/*-processor.js` | AudioWorklet modules (must be served as files) |

---

## 3. Provider configuration

The Live session is built in `src/lib/voice/liveConfig.ts`. Field names were taken from the
installed SDK typings, not from documentation that may describe another version.

| Setting | Value | Why |
|---|---|---|
| `responseModalities` | `['AUDIO']` | Native audio out. Requesting both modalities is rejected |
| `inputAudioTranscription` / `outputAudioTranscription` | `{}` | Native-audio models emit audio only; without these there is no transcript at all |
| `realtimeInputConfig.automaticActivityDetection` | `prefixPaddingMs: 120`, `silenceDurationMs: 700`, high sensitivities | Provider-side VAD. 700 ms because medical conversations contain real pauses — people stop to recall a medicine name |
| `activityHandling` | `START_OF_ACTIVITY_INTERRUPTS` | Barge-in: the model's turn is cancelled, not queued |
| `contextWindowCompression` | `{ slidingWindow: {} }` | Lifts the 15-minute audio-only session cap |
| `sessionResumption` | `{}`, then `{ handle }` | Reconnect with context after a drop |
| `temperature` | `0.3` | Grounded reception work; matches the text assistant |

---

## 4. Verification

```bash
npm run test:voice                # mocked: 252 assertions, no network, no DB writes
npm run check:voice:i18n          # interface localization coverage
npm run verify:voice              # LIVE: provider contract (needs GEMINI_API_KEY)
npm run verify:voice:languages    # LIVE: every offered language
npm run verify:voice:behaviour    # LIVE: conversation rules, using the shipped prompt
npm run verify:voice:audio        # LIVE browser: capture, playback, barge-in
npm run gen:voice:i18n            # regenerate translations after changing a source string
npx tsc --noEmit && npm run lint && npx next build
```

`test:voice` and `check:voice:i18n` need nothing. Everything prefixed `verify:` makes real
provider calls and is reported separately — see `PHASE6_REPORT.md`.

---

## 5. Deployment notes

- **Sticky sessions are required** for more than one instance. A voice session is a
  stateful socket and the pending-action store is per-process. The Redis adapter already
  configured for signaling rooms (`REDIS_URL`) covers room fan-out but not pending
  actions; moving those to Redis is the documented next step if a non-sticky multi-instance
  deployment is needed.
- **No migration.** `rescheduleAppointment` writes existing columns.
- The Docker image needs no change — `public/voice/*.js` ship as static assets and the
  gateway runs inside the existing `node server.js` entrypoint.
