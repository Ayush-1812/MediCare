# Phase 2 — Voice Architecture Decision & Design

**Branch:** `voice-agent` · **Date:** 2026-10-15
**Verification basis:** installed SDK typings (`node_modules/@google/genai/dist/genai.d.ts`, v2.10.0), a live `ListModels` query against this account's `GEMINI_API_KEY`, and Google's current Live API docs. Model IDs were **not** taken from memory — third-party sources disagreed, so the account was queried directly.

---

## 1. Decision

**Realtime speech-to-speech via the Gemini Live API (`gemini-3.8-live`), proxied server-side over the existing Socket.IO server.**

Rejected: streaming STT → LLM → TTS pipeline.

### Provider facts confirmed, not assumed

| Fact | Verified value | How verified |
|---|---|---|
| Model | `gemini-3.8-live` — `supportedGenerationMethods: ["bidiGenerateContent"]`, 131,072 in / 65,536 out | `ListModels` on this account |
| Also available | `gemini-3.1-flash-live-preview`, `gemini-2.5-flash-native-audio-latest`, `gemini-3.5-live-translate-preview`, `gemini-3.5-transcribe-live` | same |
| Input audio | raw 16-bit PCM, **16 kHz**, little-endian, mono | Live API docs |
| Output audio | raw 16-bit PCM, **24 kHz**, little-endian | Live API docs |
| Languages | 70 | Live API docs |
| Barge-in | native; server emits `serverContent.interrupted` | docs + `LiveServerContent` typings |
| Tool calls | `LiveServerMessage.toolCall`, **`toolCallCancellation`**, `LiveClientToolResponse` | SDK typings |
| VAD config | `realtimeInputConfig.automaticActivityDetection` → `disabled`, `startOfSpeechSensitivity`, `endOfSpeechSensitivity`, `prefixPaddingMs`, `silenceDurationMs`; `activityHandling: START_OF_ACTIVITY_INTERRUPTS` | SDK typings |
| Transcripts | `inputAudioTranscription` / `outputAudioTranscription` config; `serverContent.inputTranscription`, `interimInputTranscription`, `outputTranscription` | SDK typings |
| Session cap | 15 min audio-only **without** compression; ~10 min per connection | docs |
| Cap removal | `contextWindowCompression: { slidingWindow: {} }` | docs |
| Resumption | `sessionResumption: { handle }`; server sends `sessionResumptionUpdate` with `newHandle` + `resumable`; handles valid **2 h** | docs + typings |
| Disconnect warning | `goAway.timeLeft` → reconnect before `ABORTED` | docs + typings |
| Client credentials | ephemeral tokens exist and are recommended *for direct browser connections* | docs |

### Why speech-to-speech

| Criterion | Gemini Live (chosen) | STT → LLM → TTS |
|---|---|---|
| **Language quality** | One model covers 70 languages and handles mid-sentence code-switching (Hinglish is the realistic input here) natively | Three providers, three per-language coverage maps; code-switching breaks at the STT boundary |
| **Latency** | One hop; audio out begins before the text turn completes | Stacks STT finalization + LLM TTFT + TTS TTFB — typically 2-3× the first-audio latency |
| **Tool reliability** | `toolCall` + **`toolCallCancellation`** are protocol-level, so stale tool results after a barge-in are handled by the provider's own contract | Stale-result cancellation must be hand-built, and it is exactly where this class of agent leaks bugs |
| **Cost** | One billed session | Three metered services per turn |
| **Deployment compat** | `@google/genai@2.10.0` **already in `package.json`**; `server.js` already hosts Socket.IO | New dependencies and likely a new service |
| **Prosody** | Native audio keeps intonation and affect | TTS re-synthesizes from text, losing it |

The decisive factors are `toolCallCancellation` and code-switching. This is a medical receptionist for Indian users: it will receive mixed Hindi/English in one sentence, and it must never apply a tool result that belongs to an abandoned turn.

---

## 2. Topology

```
┌──────────────────────── BROWSER ────────────────────────┐
│ AudioWorklet capture → 16 kHz mono PCM16 → base64       │
│ AudioWorklet playback ← 24 kHz PCM16 queue              │
│ Transcript pane · text input fallback · state machine   │
└────────────────────────────┬────────────────────────────┘
                             │ Socket.IO  namespace /voice
                             │ (httpOnly cookie sent automatically)
┌────────────────────────────▼────────────────────────────┐
│ server.js — VoiceGateway (CommonJS)                     │
│  • authorizes handshake (JWT + role claim)              │
│  • owns the Gemini Live session per socket              │
│  • relays audio both ways, never stores it              │
│  • handles goAway / resumption / barge-in               │
└──────────┬──────────────────────────────┬───────────────┘
           │ WSS bidiGenerateContent      │ toolCall
           │                              │ (localhost HTTP, cookie forwarded)
┌──────────▼───────────┐      ┌───────────▼───────────────┐
│ Gemini Live          │      │ Next route /api/voice/tool│
│ gemini-3.8-live      │      │  → existing server actions│
└──────────────────────┘      │  → Prisma                 │
                              └───────────────────────────┘
```

### Why tool execution sits in Next, not in `server.js`

`server.js` is CommonJS by necessity — it boots before Next's build pipeline and, as its own header states, cannot import the app's TypeScript modules. More fundamentally, every existing server action resolves identity through `getSessionId`, which calls `cookies()` from `next/headers` and therefore **requires a Next request scope**. It cannot be invoked from the bare Node server at all.

Re-implementing booking or cancellation in CommonJS against Prisma would create a second source of truth for slot-holding — precisely what the Phase 1 audit forbids. So the gateway forwards the caller's cookie to an internal route handler inside Next, where the real actions run with real auth. The cost is one localhost round trip (~1-3 ms), which is negligible against a speech turn and buys a single source of truth plus unmodified authorization.

### Credentials

The long-lived `GEMINI_API_KEY` stays in the server process and is never sent to the browser. The browser authenticates to *our* server with the httpOnly session cookie it already has, so **no ephemeral token is required** for this topology. Ephemeral tokens remain the documented path if a future variant connects the browser directly to Google; that is noted, not built.

### Framework limits respected

Next route handlers cannot perform a WebSocket upgrade, which is why duplex audio rides the Socket.IO server that already exists rather than a Next endpoint. The internal tool route is a short request/response — no long-running handler, no streaming response held open, nothing that conflicts with serverless-style execution limits.

---

## 3. Requirement → mechanism

| Phase 2 requirement | Mechanism |
|---|---|
| Streaming mic input | AudioWorklet → Float32 → PCM16 @16 kHz → `sendRealtimeInput({ audio })` |
| Spoken responses | `serverContent.modelTurn` audio parts → 24 kHz playback queue |
| Voice activity detection | Provider-side `automaticActivityDetection` (`prefixPaddingMs`, `silenceDurationMs`); client also runs a local RMS meter purely for the UI |
| Natural turn-taking | `turnComplete` / `generationComplete`; `turnCoverage: TURN_INCLUDES_ONLY_ACTIVITY` |
| Interruptions stop playback | `activityHandling: START_OF_ACTIVITY_INTERRUPTS`; on `serverContent.interrupted` the client **flushes the playback queue immediately** |
| Cancel stale responses/tools | Every turn carries a monotonic `turnId`. On `interrupted`, the gateway increments it and discards late audio and late tool results; `toolCallCancellation` drops in-flight tool calls by id |
| Live transcripts | `inputAudioTranscription` + `outputAudioTranscription` enabled; interim user text via `interimInputTranscription` |
| Text-input alternative | `sendClientContent({ turns })` — same session, same tools, no mic needed |
| Context across turns | Single Live session + `contextWindowCompression.slidingWindow` to lift the 15-min cap |
| Mic permission errors | `getUserMedia` error names mapped (`NotAllowedError`, `NotFoundError`, `NotReadableError`) to specific spoken + visual guidance |
| Silence / background noise | `END_SENSITIVITY_*` tuning + an idle prompt after sustained silence |
| Connection loss | `goAway.timeLeft` pre-warning; Socket.IO reconnect; Gemini reconnect with the stored resumption handle |
| **Reconnect without repeating actions** | Each mutating tool call carries a client-generated `idempotencyKey`; completed keys are recorded per session and replayed from cache instead of re-executed |
| UI states | Explicit machine: `idle → connecting → listening → thinking → speaking → reconnecting → error` |

### Microphone ownership

Phase 1 flagged device contention with WebRTC consultations. Contract: the voice gateway releases all mic tracks on `disconnect`, on navigation to `/video-call/*`, and on explicit mute. The receptionist refuses to open a session while a consultation is live and says so.

---

## 4. Safety rails carried from Phase 1

1. Every mutating tool requires spoken read-back and an explicit yes before execution.
2. `SeverityClassifier` returning `EMERGENCY` interrupts any flow and directs to emergency care.
3. Doctor-private `Appointment.notes` is never voiced to a patient (`getConsultationDetails` already redacts it; the tool layer must not widen that).
4. No credential capture over audio — login and payment are guided, never performed.
5. Blockers stay blocked: lab reports do not exist, and the agent says so rather than inventing them.
