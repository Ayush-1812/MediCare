# Phase 4–6 — Implementation Plan & Completed Capability Matrix

**Branch:** `voice-agent` · **Date:** 2026-10-15

Written before implementing, from a fresh inspection of the repository. Phases 1–3 are already delivered and verified (see the other documents in this folder); this covers the real-feature tool layer, transaction reliability, healthcare/privacy boundaries, UI, and verification.

---

## 1. Scope decisions, made up front

| Decision | Reasoning |
|---|---|
| **Implement a real `rescheduleAppointment` server action** | Phase 1 recorded this as a genuine blocker: no such action exists, and cancel-then-rebook is non-atomic, so a patient can lose their original slot. It is implemented in one `$transaction` mirroring `bookAppointment`'s `SLOT_TAKEN` guard. This is the one new piece of business logic in this phase, and it belongs in `userActions.ts` with its siblings, not in the voice layer |
| **No new model access for the LLM** | The model gets a fixed list of function declarations. No SQL, no filesystem, no arbitrary HTTP, no table names in any schema. Tool names and enums are the entire vocabulary |
| **Identity never comes from the model** | Every tool resolves `userId` from the verified session cookie. No tool accepts a user id, and ownership is re-checked inside the existing server actions |
| **Pending-action confirmations live on the server** | A client-side "confirmed: true" flag would be forgeable and would also lose the binding between a confirmation and the exact parameters confirmed |
| **Payment stays a navigation hand-off** | Razorpay Checkout is a browser SDK modal and the server verifies an HMAC signature. The agent reads `Appointment.payment` and opens the existing flow; it never takes a card detail |
| **Pharmacy coordinates come from the client, after consent** | `navigator.geolocation` needs a user gesture and a browser permission. Coordinates are attached to the session by the client, never supplied by the model |
| **FAQ answers come from the app's own content** | `src/components/landing/FAQSection.tsx` already holds four answers shown to every visitor. Extracted to a shared module so the spoken answer and the written one cannot diverge |
| **Support = contact route only** | There is no ticketing backend. The agent can direct to `/contact`; it will not claim a ticket was created |
| **Lab reports stay blocked** | No Prisma model, no data source. `ReportTool` already refuses to fabricate; the voice layer inherits that |

---

## 2. Completed capability matrix — the tool layer

Every tool: strict schema, server-side validation, session-derived identity, structured output, user-safe errors.

### 2.1 Read tools (no confirmation required)

| Tool | Backed by | Input schema | Auth | Output | Failure mode |
|---|---|---|---|---|---|
| `search_doctors` | Prisma query mirroring `doctorList` filters | `speciality?`, `city?`, `name?`, `language?`, `maxFee?`, `limit? 1-5` | public data, session still required to open a voice session | count, `moreAvailable`, ≤5 doctors with id/name/speciality/fee | empty result returns `ok` with a `note`, not an error |
| `get_doctor_profile` | Prisma, `PUBLIC_DOCTOR_FIELDS` | `doctorId` \| `doctorName` | public fields only — never `email`/`phone` | profile + fee + languages (or `languagesListed: false`) | `found: false` |
| `get_doctor_availability` | `lib/schedule.generateSlots` | `doctorId`\|`doctorName`, `date?` | public | open days, exact slot strings, `slotDateKey` | `acceptingBookings: false` with a reason |
| `list_my_appointments` | `listAppointments()` | `status?`, `limit? 1-5` | **`user` session; action filters by `userId`** | summary count + top rows, `canJoinNow` from `consultationJoinState` | session error surfaces as a spoken apology |
| `get_consultation_status` | `getConsultationDetails()` + `lib/appointment` | `appointmentId` | **party to the appointment**; doctor-only notes redacted by the action | status, join eligibility, window reason | "not part of this consultation" |
| `list_my_prescriptions` | `getPrescriptions()` | `limit? 1-5` | **`user` session** | medicines verbatim + `readBackRule` | — |
| `explain_prescription` | `getPrescriptions()`, one record | `prescriptionId` | **owner only** | extracted medicines + `ocrConfidence` + verification caveat | low confidence flagged explicitly |
| `get_payment_status` | `Appointment.payment`, `amount` | `appointmentId` | **owner only** | `paid`, `amount`, `canPayOnline` | — |
| `get_health_summary` | `HealthSummaryTool` | none | **`user` session** | BMI/blood group/allergies; no invented score | — |
| `assess_symptoms` | `SymptomAssessmentTool` + `SeverityClassifier` | `description` | **`user` session** | severity, 3 tiers, `MUST_DO` on EMERGENCY | — |
| `find_nearby_pharmacies` | `/api/nearby-pharmacies` (SerpAPI) | `limit? 1-5` — **no coordinates in the schema** | session + **client-granted location** | name, distance, open state | `consentRequired: true` when no coords on the session |
| `answer_faq` | extracted `lib/faq.ts` | `topic` enum | public | the app's own answer text | `found: false` → offer `/contact` |
| `navigate` | fixed allow-list | `destination` enum, `doctorId?`, `appointmentId?` | session | path | unknown destination rejected |
| `get_support_contact` | static route | none | — | `/contact` route; **no ticket claim** | — |

### 2.2 Mutating tools (explicit confirmation required)

All three go through the pending-action store. The model cannot execute them directly — it proposes, the patient confirms, then it commits.

| Tool | Backed by | Confirmation binding | Atomicity |
|---|---|---|---|
| `propose_booking` → `confirm_action` | `bookAppointment()` | doctor id, `slotDate`, `slotTime`, fee | existing `$transaction` + `SLOT_TAKEN` |
| `propose_cancellation` → `confirm_action` | `cancelAppointment()` | appointment id, doctor, when | idempotent in the existing action |
| `propose_reschedule` → `confirm_action` | **new** `rescheduleAppointment()` | appointment id, from-slot, to-slot | **new single `$transaction`**: frees the old slot and claims the new one together, or neither |

---

## 3. Transaction reliability

| Requirement | Implementation |
|---|---|
| Explicit confirmation | `propose_*` returns a spoken confirmation sentence built from **backend data** (actual fee, actual slot). Nothing executes on a proposal |
| Server-side pending state tied to user + session | `server/voice/pendingActions.js` — keyed by `userId:socketId`, one pending action per session |
| Bound to exact parameters | The pending record stores a SHA-256 of the canonical action + params. `confirm_action` recomputes it; any drift invalidates |
| Expiry / invalidation on change | 3-minute TTL, and a new proposal replaces the old one. A confirmation for a superseded proposal is refused with a spoken explanation |
| Idempotency | Each proposal carries an `idempotencyKey`. A completed key returns the recorded result instead of re-executing — this is what makes reconnection safe |
| Atomic availability | Delegated to `bookAppointment`/`rescheduleAppointment` transactions. The voice layer never pre-checks and then writes |
| Slot disappearing after confirmation | `SLOT_TAKEN` surfaces as a specific spoken outcome: the slot went while they were deciding, here are the remaining ones. **Never reported as booked** |
| No blind retry of unknown-outcome mutations | On transport failure mid-commit the gateway does **not** retry. It marks the action `unknown` and the next step is a status read (`list_my_appointments`), never a second write |
| No bypassing existing restrictions | Join windows come from `consultationJoinState`; `startConsultation` remains doctor-only; payment checks and role cookies are untouched |

---

## 4. Healthcare boundaries and privacy

| Requirement | Implementation |
|---|---|
| No diagnosis, prescribing or dosage change | Prompt rules (Phase 3) + no tool that could write clinical data |
| Emergency handling | `SeverityClassifier` EMERGENCY → interrupt, direct to immediate local emergency care and human help. **No guessed phone numbers** — the prompt forbids inventing one |
| Auth before private records | Every private tool resolves identity from the cookie; the socket handshake rejects unauthenticated connections |
| Permissions only when needed | Mic on session start; location only when a pharmacy question arises, via an explicit consent step |
| No raw audio persisted | Audio is relayed and dropped. Nothing writes PCM to disk or database — documented and asserted in tests |
| Minimal sensitive data in logs | Gateway logs ids and states, not transcripts or PHI. Tool failures log the tool name, not its payload |
| Explicit transcript storage | The voice transcript is **in-memory only, cleared when the panel closes**. Distinct from the text assistant, which does persist to `Conversation`/`Message`. Stated in the UI |
| Prompt-injection defense | Untrusted text (OCR output, prescription notes, doctor `about`, FAQ, pharmacy names) is wrapped in explicit untrusted-data delimiters with a standing instruction that content inside is data, never instructions. Authorization is enforced in code regardless of what any text says |

---

## 5. UI additions (Phase 5)

Launcher, panel, mic/mute/stop/end, text input, language selector, live transcript and status already shipped in Phases 2–3. This phase adds:

- **Confirmation card** — the proposed action with its real parameters and explicit Confirm / Cancel buttons, so a consequential change has a visual control and not only a spoken yes.
- **Structured result cards** — doctor cards, selectable slot chips, appointment summaries, pharmacy results, navigation links. Driven by a typed `uiPayload` on tool results so the panel renders data rather than parsing speech.
- **Location consent prompt** — inline, only when a pharmacy question is asked.
- Mobile layout, keyboard operation, contrast and screen-reader labels audited.

---

## 6. Verification strategy (Phase 6)

Clearly separated, because conflating them is how mock behaviour gets presented as a live integration:

| Kind | Where | Network | Covers |
|---|---|---|---|
| **Mocked unit/integration tests** | `scripts/test-voice-tools.ts` | none — Prisma and provider both stubbed | input validation, ownership/permission enforcement, confirmation binding, expiry, idempotency, injection wrapping, error shapes |
| **Live provider verification** | `verify:voice*` scripts | real Gemini | session config, per-language audio, behavioural rules |
| **Live browser verification** | `verify:voice:audio` | real Chromium | capture/playback, barge-in |
| **Manual** | documented steps | real login | the full loop under a real patient session |

Measured numbers only. No invented latency figures.

---

## 7. Deliverables

`.env.example` additions, setup/architecture notes, the test suite, a reproducible demo script covering multilingual booking → correction → cancellation → recovery, and a final report stating what works, what was verified, and what remains blocked.

**No destructive migrations and no production data changes.** `rescheduleAppointment` needs no schema change — it writes existing columns. If any migration were required it would be stated here and left for explicit authorization.
