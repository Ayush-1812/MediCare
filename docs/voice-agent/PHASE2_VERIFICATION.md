# Phase 2 — Verification Record

**Branch:** `voice-agent` · **Date:** 2026-10-15
Everything below was executed, not reasoned about. Commands and their results are reproducible with the two npm scripts at the end.

---

## 1. Static and build

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | **Clean**, no errors |
| Production build | `npx next build` | **Succeeds** |
| Routes registered | build output | `ƒ /api/voice/session`, `ƒ /api/voice/tool` both present |
| CommonJS syntax | `node --check` on `server.js`, `server/lib/session.js`, `server/voice/gateway.js` | All **OK** |

## 2. Provider contract — `npm run verify:voice`

Opens a real Gemini Live session with the config shape the app builds, drives one text turn through a tool call, and asserts each dependency. **9/9 passed.**

| Check | Result |
|---|---|
| `live.connect` accepted the session config | PASS — `gemini-3.8-live` |
| Setup completed | PASS |
| Prebuilt voice `Zephyr` accepted | PASS — no setup rejection |
| Native audio returned | PASS — **246,722 bytes** of PCM |
| Output transcription populated | PASS — *"You have an upcoming appointment with Dr. Mehta on October 18th at 4:30 PM."* |
| Function calling fired | PASS — `list_my_appointments({"status":"upcoming"})` |
| Tool response accepted | PASS |
| Turn completed | PASS |
| Session resumption handle issued | PASS — reconnect will keep context |

Two things worth noting from that transcript: the model chose the right tool unprompted, and it spoke the date as *"October 18th at 4:30 PM"* rather than echoing the stored `18 October 2026 at 04:30 PM` — which is the prompt's speech-formatting rule working.

**A bug this run caught, in the harness rather than the app:** the first attempt reported zero audio and an empty transcript. The cause was that a tool-calling exchange produces *two* turn boundaries — one ending the turn where the model requests the tool, one ending the spoken reply built from the result — and the harness stopped on the first, closing the socket before any audio was generated. Fixed and commented, since the same mistake in the gateway would look exactly like a provider fault.

## 3. Browser audio pipeline — `npm run verify:voice:audio`

Drives headless Chromium with a synthetic microphone (a generated 440 Hz WAV) against both AudioWorklet processors. No login and no database: the worklets are pure signal plumbing, and this repo's `DATABASE_URL` points at production, where minting a session to click a UI would mean reading a real patient's record into a test log. **11/11 passed.**

| Check | Result |
|---|---|
| Server reachable | PASS |
| Worklet modules served | PASS — both `200` |
| Capture context runs at 16 kHz | PASS — the rate the Live API requires |
| Capture emits frames | PASS — 70 frames in 1.5 s (≈20 ms each) |
| Frames are 320-sample PCM16 | PASS — every frame exactly 640 bytes |
| Microphone audio is non-silent | PASS — peak 0.555, so audio is flowing rather than frames of zeroes |
| Mute stops frames | PASS — 0 frames after mute, graph intact |
| Playback context runs at 24 kHz | PASS |
| Playback drains and reports it | PASS |
| Flush acknowledged | PASS |
| **Flush discards queued audio (barge-in)** | PASS — a 3 s buffer drained **1029 ms** after flush instead of playing out |

That last row is the interruption guarantee measured rather than asserted: three seconds of queued speech stopped within about a second of the flush.

## 4. Runtime and security gates

| Check | Result |
|---|---|
| Server boots with gateway attached | PASS — `[voice] receptionist gateway listening on /voice` |
| Existing signaling unaffected | PASS — `[signaling] Socket.IO listening on /api/socket` still logged |
| `/api/voice/tool` without internal header | **403** |
| `/api/voice/session` without internal header | **403** |
| `/api/voice/tool` with a wrong secret | **403** `{"ok":false,"error":"Forbidden"}` |
| Worklets served from `/voice/*.js` | **200** both |
| `/voice` socket handshake with no session | **Rejected** — *"Please sign in to use the voice assistant"* |

## 5. What is NOT yet verified

Stated plainly, because the difference between tested and assumed is the whole point of this document.

| Gap | Why it was not covered | How to close it |
|---|---|---|
| **Full loop under a real login** — speak, hear a grounded answer about your own data | Needs an authenticated patient session. The only database configured here is production, so minting one would read a real person's medical record into a test | **One manual run:** `npm run dev`, sign in as a patient, click the mic button, ask *"what appointments do I have?"* Every layer beneath this is verified independently |
| Barge-in with real speech | The flush mechanism is measured (§3) but not with a human talking over the assistant | Same manual run: interrupt mid-sentence |
| Reconnection on `goAway` | Requires a session to run past the provider's ~10-minute connection life | Hold a session open past 10 min and watch for `[voice] reconnecting`; the resumption handle is confirmed issued (§2) |
| Mic contention with a live consultation | Needs two parties in a real WebRTC call | Join a consultation, then try to open the receptionist — expect the handshake refusal. Note the UI already prevents it structurally, since the receptionist is not mounted on immersive routes |
| Multilingual quality per language | 11 languages are offered; the provider advertises 70 and detects spoken language itself | Spot-check Hindi and one more, including a code-switched sentence |
| Mid-session language switch | Reopens the provider session; the path exists but was not exercised | Change the picker mid-call |

## 6. Reproducing

```bash
npm run verify:voice          # provider contract, needs GEMINI_API_KEY
npm run verify:voice:audio    # browser audio pipeline, boots its own server
```

`verify:voice:audio` pins its own Chromium: `playwright-core@1.62.1` expects build 1234 while this machine has 1248, so the script resolves the newest installed build itself rather than requiring a ~130 MB download. `CHROMIUM_PATH` overrides it.
