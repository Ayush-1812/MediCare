# Voice Receptionist — Final Report

**Branch:** `voice-agent` · **Date:** 2026-10-15 · **Model:** `gemini-3.8-live`

What works, what was verified and how, and what is still blocked. Every number here was produced by a command in this repository. Nothing is estimated.

---

## 1. What was built

A multilingual AI voice receptionist inside MediCare, on the existing stack: **no new services, no new runtime dependencies**, one new devDependency (`tsx`) to run the TypeScript verification scripts.

| Layer | What it is |
|---|---|
| Transport | Socket.IO namespace `/voice` on the **existing** `server.js`, JWT-authorized handshake |
| Provider | Gemini Live (`gemini-3.8-live`) via `@google/genai@2.10.0`, which was already in `package.json` |
| Audio | Two AudioWorklets — 16 kHz capture, 24 kHz flushable playback |
| Tools | **21 declared tools** onto existing server actions; no SQL, filesystem or HTTP access |
| Transactions | Server-side propose → confirm with fingerprint binding, TTL, idempotency |
| UI | Launcher, panel, transcript, cards, confirmation controls, 11-language picker |
| New business logic | One action: `rescheduleAppointment`, atomic |

### The one piece of new business logic

`rescheduleAppointment` closes a blocker found in the Phase 1 audit: MediCare had **no reschedule at all**, and cancel-then-rebook is not atomic — between the two steps the patient's original slot is released, so a lost race leaves them with nothing having started with a valid appointment. Both halves now happen in a single `$transaction`. No migration: it writes existing columns.

---

## 2. Verified — live

These make real provider calls. **Nothing here is mocked.**

| Suite | Command | Result |
|---|---|---|
| Provider contract | `npm run verify:voice` | **9/9** — 246 KB of real PCM, correct tool call, resumption handle issued |
| Per-language | `npm run verify:voice:languages` | **12/12** — every offered language produced real audio *and* a reply in the correct script |
| Conversation behaviour | `npm run verify:voice:behaviour` | **7/7** — tests the shipped prompt, imported not copied |
| Browser audio | `npm run verify:voice:audio` | **11/11** — real Chromium, synthetic mic, barge-in measured |
| End-to-end demo | `npm run demo:voice` | **Passes** — see §4 |

### Measured latency

`npm run measure:voice`, 3 runs per case, real provider over the public internet from one machine:

| | runs | median |
|---|---|---|
| First audio, direct answer | 1455, 1544, 1740 ms | **1544 ms** |
| First audio, with one tool call | 2023, 2169, 3048 ms | **2169 ms** |
| Session setup (connect → `setupComplete`) | — | **1593 ms** |

System prompt: **10,629 chars (~2,658 tokens)**. 21 declared tools.

Indicative of this environment, not a benchmark. The tool-call case is slower because a lookup happens first, which is why the prompt requires a short bridging phrase so the pause is not silence.

---

## 3. Verified — mocked

`npm run test:voice` — **252/252 assertions**, no provider calls, no database writes. The header says so explicitly; this is not integration verification.

Covers:

- **Confirmation binding** — order-independent fingerprinting; a changed parameter or action is refused as `mismatch` and leaves the proposal intact
- **Single-claim** — a second `confirm_action` finds nothing pending, so a repeated confirmation cannot double-execute
- **Expiry** — an expired proposal reports `expired`, not `none` (these produce different spoken explanations)
- **Supersession** — a new proposal replaces the old one, so a corrected time cannot be confirmed as the original
- **Idempotency** — a completed action replays its recorded outcome; unknown outcomes are recorded as `unknown`, not as failures
- **Untrusted content** — injected terminators cannot close the wrapper early; a second opener cannot be forged; null fields are not wrapped into the string `"null"`
- **Exposed surface** — no `execute_*`/`commit` name is declared to the model; no tool accepts `userId`, `sql`, `query`, `url` or `path`; the pharmacy tool declares no coordinates; `confirm_action` cannot supply the parameters it commits
- **No raw audio** — a static check that the gateway contains no `writeFile`, `createWriteStream`, `appendFile`, `fs.write`, no Prisma client, and no transcript logging. The strongest form of "audio is not stored" is that there is no code able to store it
- **Script detection** — regression tests for the danda bug, including a Latin doctor name inside a Hindi sentence
- **Localization** — every offered language ≥90%

### Quality gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **Clean** |
| `npx next build` | **Succeeds** — `/api/voice/session`, `/api/voice/tool`, `/api/voice/commit` registered |
| `npm run check:voice:i18n` | **72 strings × 11 languages**, 99–100% |
| Lint, voice files only | **Clean — 0 problems** |
| Lint, whole project | 154 problems. **109 errors are pre-existing** `no-explicit-any` in `src/lib/ai` and other files predating this work. My code contributed 2 warnings, both fixed (156 → 154) |

---

## 4. The demo, verified end to end

`npm run demo:voice` — real prompt, **real pending-action store**, canned database. Eight turns in Hinglish then English:

| Step | Verified |
|---|---|
| "Mujhe kal shaam Dr Mehta ke saath appointment chahiye" | Offered the three real slots, **did not book** |
| Patient picks 5 o'clock | Proposal stored (expires in 180 s) |
| **"Nahi nahi, sorry — paanch baje nahi, paanch tees karo"** | A new proposal superseded the first |
| "Haan, confirm kar do" | Committed **05:30 PM, not 05:00** — the corrected value |
| "cancel that… and let us continue in English" | Switched language mid-flow, proposed the cancellation |
| "Yes, please cancel it" | Committed |
| Fresh proposal, **force-expired** behind the scenes | `confirm_action` **refused** (`reason: expired`); agent offered to re-check availability; nothing booked |

Final state: 05:30 booked then cancelled, no leftover proposal.

---

## 5. Bugs found and fixed during verification

Listed because they are the reason the numbers above mean anything.

| Bug | Where | Consequence if unfixed |
|---|---|---|
| Danda `।` (U+0964) is in the **Devanagari** block but is shared Indic punctuation | language probe + `detectScript` | Correct Bengali and Punjabi were classified as Devanagari — would have failed two working languages and caused false language-switch prompts |
| `audioBytes > 0` accepted **118 bytes** as working audio | language probe | Tamil scored a pass on ~2 ms of silence |
| Turn boundaries are not a completion signal (a tool exchange is sometimes one turn, sometimes two) | two harnesses | Truncated answers to the bridging phrase, or hung until timeout — and blamed the model both times |
| i18n check parsed **46 of 50** strings (regex required same-line values) | `check-voice-i18n.js` | The check meant to catch missing strings could not see four of them |
| i18n generator preserved existing catalogs **only on single-language runs** | `generate-voice-i18n.js` | A transient provider 503 during a full run **deleted** a complete Punjabi catalog |
| `peek()` deleted expired records | `pendingActions.js` | Whether a patient heard "that expired, let me set it up again" or "there is nothing to confirm" depended on call order |
| Timezone stated in confirmations only intermittently | prompt | A patient could be given a time with no clock reference |
| After committing, the model re-asked "Shall I book it?" | prompt | Reads as a failure — the likeliest next action is the patient asking to book twice |
| Behaviour harness had no `propose_booking` stub | `verify-voice-behaviour.ts` | Scored correct behaviour as a failure after the propose/confirm split landed |

Two Phase 1 audit errors of mine were also corrected in place: slot generation was **already** extracted to `src/lib/schedule.ts`, and `consultationJoinState` **does** implement a 15-minute join window.

---

## 6. Remaining blockers and limitations

### Blocked by the application, not by this work

| Blocker | Status |
|---|---|
| **Payment** | Razorpay Checkout is a browser SDK modal and the server verifies an HMAC signature. The agent reads `Appointment.payment` and opens the existing flow. It never takes a card, UPI id or OTP. **By design, not a gap to close** |
| **Lab results / imaging** | No Prisma model, no data source. `ReportTool` already refuses to fabricate; the voice layer inherits that refusal |
| **Support tickets** | No ticketing backend. `get_support_contact` returns `canCreateTicket: false` and the agent is instructed to say so rather than imply something was filed |
| **Admin surface** | Excluded deliberately. Admin credentials live in env vars with `timingSafeEqual` and no DB identity or MFA; voice-authenticating that role is not defensible |
| **`Doctor.languages` is unreliable** | Free text; **10 of 13 doctors have nothing recorded**, and one value is misspelled `HIndi`. Search matches case-insensitively and the agent says "not listed" rather than guessing. Fixing it properly means making the field structured — a change to doctor onboarding, outside this feature |

### Needs one manual run

**The full loop under a real patient login.** Every layer beneath it is verified independently — provider, audio, tools, confirmations, behaviour — but the configured `DATABASE_URL` is production, and minting a session to click through the UI would read a real patient's medical record into a test log. I did not do that.

```
npm run dev  →  sign in as a patient  →  click the mic  →  "what appointments do I have?"
```

Also worth exercising by hand: barge-in with real speech, `goAway` reconnection (needs a 10-minute session), mic contention during a live consultation, and the mobile layout on a real device.

### Known limitations

| # | Limitation |
|---|---|
| 1 | **Translations are model-authored and not native-reviewed.** Recorded in `i18n.generated.ts`'s header; corrections edit the value in place |
| 2 | **Script detection cannot separate Hindi from Marathi** (both Devanagari), so it offers a switch rather than applying one |
| 3 | **Pending actions are per-process.** Correct for one container or sticky sessions — already required for a stateful voice socket. A non-sticky multi-instance deployment needs them in Redis, following the pattern `server.js` already uses for signaling rooms |
| 4 | **Language switch replays text, not audio.** `speechConfig.languageCode` is fixed at setup, so a switch needs a new session; a capped turn history is replayed. Task context survives, prosody does not |
| 5 | **Reschedule is same-doctor only.** Changing doctor changes the fee and is a new booking; the agent says so |
| 6 | **Transcripts are in-memory only** and cleared when the panel closes. Deliberately unlike the text assistant, which persists to `Conversation`/`Message`. Stated in the panel |
| 7 | **Occasional transient provider failures** — an empty generation (1 in 6 runs of one scenario) and a 503 during catalog generation. Both degrade safely; neither is retried blindly |
| 8 | Prompt-injection delimiting reduces the chance the model is fooled; it is **not** what keeps the system safe. Authorization is enforced in server actions regardless of any text |

---

## 7. Honest summary

**Works and is verified:** the voice loop end to end against the real provider; 21 tools over real MediCare features with session-derived identity and ownership enforcement; propose → confirm for every consequential action with binding, expiry, supersession and idempotency; atomic reschedule; 11 languages with Hinglish code-switching; a fully localized interface; barge-in measured at ~1 s to flush a 3 s buffer; no raw audio stored.

**Not verified:** the complete loop under a real login, and the hand-operated cases in §6. I have not claimed those.

**Not mocked anywhere in the live suites.** Where mocks are used — `test:voice` and the demo's database — the scripts say so in their headers and in this report.

Nothing was deployed. No destructive migration was run. No production data was altered.
