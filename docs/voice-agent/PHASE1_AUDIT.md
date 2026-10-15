# Phase 1 — Application Audit & Voice Receptionist Capability Matrix

**Scope:** multilingual AI voice receptionist inside the existing MediCare app.
**Method:** read-only inspection of the repository. The codebase is the source of truth; nothing below is assumed from the brief.
**Branch:** `voice-agent` · **Audited:** 2026-10-15

---

## 1. Platform facts established by inspection

| Dimension | Finding | Source |
|---|---|---|
| Framework | Next.js **16.1.6**, React **19.2.3**, App Router, TypeScript | `package.json` |
| Server | **Custom Node HTTP server** (CommonJS) wrapping Next + Socket.IO on `/api/socket` | `server.js` |
| Data layer | PostgreSQL via Prisma **5.22**, **6 models** (`User`, `Doctor`, `Appointment`, `Prescription`, `Conversation`, `Message`) | `prisma/schema.prisma` |
| Business logic | **39 server actions** across 7 files + **6 API route handlers** | `src/app/actions/`, `src/app/api/` |
| Auth | JWT in **httpOnly cookies**, 3 separate cookies (`token` / `docToken` / `adminToken`), `role` claim verified alongside signature, 7-day expiry | `src/lib/auth.ts` |
| Authorization | 2 layers — Edge middleware (presence check only, cannot verify signature on Edge) + per-action verification | `src/middleware.ts:30`, `src/lib/auth.ts:62` |
| AI layer | `AIOrchestrator` → `IntentRouter` → `ToolRegistry` (**7 tools**) → `ContextBuilder` → `PromptManager` → `GeminiService` | `src/lib/ai/` (~1,968 LOC) |
| LLM | `gemini-2.5-flash` via `@google/genai@2.10.0`; streaming + `responseSchema` structured output already in use | `src/lib/ai/config/geminiConfig.ts`, `services/geminiService.ts` |
| Realtime | WebRTC P2P, perfect-negotiation, JWT-authorized handshake, Redis pub/sub adapter (optional) | `server.js:66`, `src/lib/webrtc/useWebRTCCall.ts` |
| Payments | Razorpay order + **HMAC-SHA256** server-side signature verification | `src/app/actions/paymentActions.ts:102` |
| Deployment | 4-stage Dockerfile + `HEALTHCHECK`, 3 compose services (app/redis/postgres) | `Dockerfile`, `docker-compose.yml` |

### Pre-existing conditions that shape this feature

1. **No localization exists.** Zero i18n libraries; the only matches for "locale" are 12 uses of `toLocaleDateString`/`toLocaleTimeString`. Multilingual support is a **greenfield build**, not an extension.
2. **No voice/audio code exists.** No `SpeechRecognition`, `SpeechSynthesis`, `MediaRecorder`, `AudioContext`, or `AudioWorklet` anywhere in `src/`.
3. **No test infrastructure.** No jest/vitest/playwright config and no `*.test.*`/`*.spec.*` files. `playwright-core` is an unused devDependency. Verification must be manual or bring its own harness.
4. **`@google/genai@2.10.0` includes the Live API** — `class Live`, `LiveServerMessage`, `LiveClientToolResponse`, `LiveSendToolResponseParameters`, `AudioTranscriptionConfig`, `Modality`, `speechConfig` are all present in `dist/genai.d.ts`. Native audio dialog **with function calling** is available without adding a dependency.
5. **`server.js` already hosts Socket.IO**, so a voice audio channel needs no new infrastructure — it can take its own namespace alongside the existing signaling path.
6. **`/api/chat` streaming is simulated.** The orchestrator response is generated in full, then re-emitted word-by-word with a 50ms `setTimeout` (`src/app/api/chat/route.ts`). Acceptable for text chat; a blocking first-token cost for voice.

---

## 2. Capability matrix

**Legend — Capability:** `READ` = agent speaks information back · `ACT` = agent performs the mutation via existing logic · `GUIDE` = agent navigates/explains, user completes it · `BLOCKED` = documented blocker.
**Confirm:** explicit spoken confirmation required before execution.

### 2.1 Patient — identity & profile

| # | Feature | Existing implementation | Capability | Auth / role | Confirm | Gaps & dependencies | Outcome |
|---|---|---|---|---|---|---|---|
| 1 | Register | `registerUser` `userActions.ts:56` | `GUIDE` | public | — | Passwords must never be captured over audio or logged in a transcript | Guided navigation to `/login` |
| 2 | Login | `loginUser:99` | `GUIDE` | public | — | Same credential constraint; voice agent needs an authenticated session to be useful at all | Guided navigation |
| 3 | Logout | `logoutUser:130` | `ACT` | `user` | **Yes** | None | Voice support |
| 4 | View profile | `getProfile:137` | `READ` | `user` | — | None | Voice support |
| 5 | Update profile | `updateProfile:167` | `ACT` | `user` | **Yes** (field read-back) | Takes `FormData` — needs a typed wrapper for programmatic calls | Voice support |
| 6 | Health profile (height/weight/blood group/allergies) | `updateProfileDetails:436`; nullable columns on `User` | `READ` + `ACT` | `user` | **Yes** | Allergies are free text — read back verbatim, never normalized | Voice support |

### 2.2 Patient — doctor discovery & booking

| # | Feature | Existing implementation | Capability | Auth / role | Confirm | Gaps & dependencies | Outcome |
|---|---|---|---|---|---|---|---|
| 7 | Doctor directory | `doctorList:500` (filters `profileCompleted`, returns `PUBLIC_DOCTOR_FIELDS`, no email) | `READ` | public | — | Speciality filtering happens in the client (`DoctorsDirectory`, `/doctors/[speciality]`), not in the action — voice needs a server-side filtered query | Voice support |
| 8 | Specialities | `SpecialityMenu.tsx`, `/doctors/[speciality]` | `READ` | public | — | Speciality list is UI-side; `Doctor.speciality` is a nullable free-text string, not an enum — fuzzy voice matching required | Voice support |
| 9 | Doctor profile, fees, languages, hospital | `Doctor` model; `/appointment/[docId]` | `READ` | public | — | `fees` is nullable (`amount: fees ?? 0`) — must not be spoken as "free" | Voice support |
| 10 | Availability / open slots | Derived from `availableDays`, `slotStartTime`, `slotEndTime`, `slotDuration`, `slots_booked` | `READ` | public | — | Already extracted to `src/lib/schedule.ts` (`generateSlots`, `parseAvailableDays`, `toSlotMap`) — framework-agnostic, no `use client`, directly reusable by voice. **Correction to the first draft of this audit, which wrongly placed this logic in the page component** | Voice support (reuse `lib/schedule`) |
| 11 | Book appointment | `bookAppointment:224` — `$transaction` guards the read-modify-write on `slots_booked`, throws `SLOT_TAKEN`; emails deferred via `after()` | `ACT` | `user` | **Yes — mandatory** (doctor, date, time, fee) | Reuse as-is. Race-safety and email are already handled; voice must not reimplement | Voice support |
| 12 | Payment | `createPaymentOrder:36`, `verifyPayment:80` (HMAC-SHA256 of `order_id\|payment_id`) | `BLOCKED` → `GUIDE` | `user` | — | Razorpay Checkout is a **browser SDK modal**; card/UPI entry cannot and must not happen over voice (PCI + the server never trusts a client callback alone) | Documented blocker; hand off to UI after booking |
| 13 | Appointment history | `listAppointments:361` | `READ` | `user` | — | Returns all appointments unpaginated — voice must summarize, not read 40 rows aloud | Voice support |
| 14 | Cancel appointment | `cancelAppointment:391` — frees the slot, idempotent if already cancelled | `ACT` | `user` | **Yes — mandatory** | Reuse as-is | Voice support |
| 15 | **Reschedule** | **Does not exist** — no action in the codebase | `GUIDE` | `user` | **Yes** | **Gap.** Achievable only as cancel + rebook, which is *not* atomic: if the new slot is taken after cancelling, the patient loses the original slot | Documented blocker; offer explicit cancel-then-rebook with the risk stated aloud |

### 2.3 Patient — consultation

| # | Feature | Existing implementation | Capability | Auth / role | Confirm | Gaps & dependencies | Outcome |
|---|---|---|---|---|---|---|---|
| 16 | Join video consultation | `/video-call/[appointmentId]`, `VideoCallStage`, `useWebRTCCall`, signaling in `server.js` | `GUIDE` | `user` or `doctor`, **and** party to the appointment (`server.js:84`) | — | **Device contention:** the voice agent holds the microphone. It must release the mic before the call and must not run during one. Also `startConsultation` is **doctor-only** (`consultationActions.ts:79`) — a patient cannot open the room | Guided navigation + readiness check |
| 17 | Consultation status / window | `cancelled`, `isCompleted`, `startTime`, `endTime`, `duration` on `Appointment` | `READ` | party to appointment | — | No scheduled-window gate found — the room is gated on role + cancelled/completed state, not clock time | Voice support |
| 18 | Consultation summary (diagnosis, prescription, follow-up) | `getConsultationDetails:189` — nulls the doctor's private `notes` for anyone but the doctor | `READ` | party to appointment | — | Honor the same field-level redaction when speaking. Doctor's `notes` must never be voiced to a patient | Voice support |
| 19 | Patient's own notes | `savePatientNotes:164`, `PatientNotesPanel` | `READ` + `ACT` | `user` | **Yes** (read back before save) | Dictation is a natural voice win | Voice support |

### 2.4 Patient — prescriptions & records

| # | Feature | Existing implementation | Capability | Auth / role | Confirm | Gaps & dependencies | Outcome |
|---|---|---|---|---|---|---|---|
| 20 | Prescription upload + OCR | `PrescriptionUpload.tsx` → Tesseract.js **in-browser** → `processPrescriptionText:82` → `prescriptionParser.ts` + Gemini `prescriptionCorrector.ts` → `savePrescription:142` | `GUIDE` | `user` | **Yes** on save | Requires a file picker / camera — not voice-completable. Voice can drive the *review* step after OCR | Guided navigation (+ voice read-back of parsed medicines) |
| 21 | List prescriptions | `getPrescriptions:197` | `READ` | `user` | — | Dosage must be spoken exactly as stored; never paraphrase or round a dose | Voice support |
| 22 | Delete prescription | `deletePrescription:224` | `ACT` | `user` | **Yes — mandatory** | Destructive and irreversible | Voice support |
| 23 | Lab results / imaging reports | `ReportTool` is an **honest stub** — returns `available: false`. **No Prisma model exists** | `BLOCKED` | — | — | **No data source.** The tool already refuses to fabricate results (`PatientDataTools.ts:101`); voice must inherit that refusal verbatim | Documented blocker — state the feature does not exist |

### 2.5 Patient — assistance & utilities

| # | Feature | Existing implementation | Capability | Auth / role | Confirm | Gaps & dependencies | Outcome |
|---|---|---|---|---|---|---|---|
| 24 | Nearby pharmacies | `/api/nearby-pharmacies` → SerpAPI, haversine distance, zoom-tuned radius | `READ` + `GUIDE` | **none — route is unauthenticated** | — | Needs `navigator.geolocation` consent (browser permission, must be requested in UI context) + `SERPAPI_KEY`. The missing auth check on this route is a pre-existing finding, flagged not fixed | Voice support (location consent spoken first) |
| 25 | Dr. AI / "Aether" assistant | `/api/chat` + `AIOrchestrator`; history persisted in `Conversation`/`Message`, last 10 turns replayed | `READ` + `ACT` | `user` | per-tool | **Reuse, do not duplicate.** Voice should call the same orchestrator. Blocker for latency: streaming is simulated (full generation, then 50ms/word) | Voice support via shared orchestrator |
| 26 | Symptom assessment | `SymptomAssessmentTool` + `SeverityClassifier` (3 tiers: `NORMAL`/`CAUTION`/`EMERGENCY`, 22 patterns) | `READ` | `user` | — | **Safety rail:** an `EMERGENCY` classification must interrupt and direct to emergency care, never continue a booking flow | Voice support with mandatory escalation |
| 27 | Health summary | `HealthSummaryTool` — computes BMI, explicitly refuses to invent a health score | `READ` | `user` | — | Inherit the no-fabricated-score rule | Voice support |
| 28 | Conversations list / delete | `/api/chat/conversations`, `/api/chat/conversations/[conversationId]` | `READ` + `ACT` | `user` | **Yes** on delete | None | Voice support |
| 29 | Notifications | **Email only** — Nodemailer via `after()`, non-blocking by design | `READ` ✗ | — | — | **Gap:** no in-app notification model, no SMS, no push. Nothing for the agent to read back | Documented blocker |
| 30 | Support / contact | `/contact`, `/about` — static informational pages | `GUIDE` | public | — | No ticketing backend | Guided navigation |

### 2.6 Doctor role

| # | Feature | Existing implementation | Capability | Auth / role | Confirm | Gaps & dependencies | Outcome |
|---|---|---|---|---|---|---|---|
| 31 | Doctor signup / login / onboarding | `registerDoctor:123`, `loginDoctor:163`, `completeDoctorOnboarding:204` | `GUIDE` | `docToken` | — | `profileCompleted=false` holds self-signups out of the directory | Guided navigation |
| 32 | Doctor dashboard + appointments | `doctorDashboard:367`, `appointmentsDoctor:292` | `READ` | `doctor` | — | Reads other people's PHI aloud — only safe in a private setting; needs an explicit opt-in | Voice support (read-only, deferred to a later phase) |
| 33 | Mark complete / cancel | `appointmentComplete:313`, `appointmentCancelDoctor:331` | `ACT` | `doctor` | **Yes** | Affects a patient's record | Voice support (later phase) |
| 34 | Write diagnosis / prescription | `endConsultation:109` | `ACT` | `doctor` | **Yes — mandatory read-back** | **Highest-risk surface in the app.** Voice dictation of a drug name or dose that is mis-transcribed is a patient-safety event. Requires visual confirmation before commit | Documented constraint — dictate to draft, never auto-commit |
| 35 | Doctor profile | `doctorProfile:402`, `updateDoctorProfile:419` | `READ` + `ACT` | `doctor` | **Yes** | `FormData` wrapper needed | Voice support (later phase) |

### 2.7 Admin role

| # | Feature | Existing implementation | Capability | Auth / role | Confirm | Gaps & dependencies | Outcome |
|---|---|---|---|---|---|---|---|
| 36 | Admin login | `loginAdmin:59` — credentials in **env vars**, `crypto.timingSafeEqual` comparison, no DB row | `BLOCKED` | `adminToken` | — | Deliberately out of scope: voice-authenticating a privileged account with no DB identity and no MFA is an unacceptable risk | Documented blocker — excluded by design |
| 37 | Add doctor / toggle availability / platform stats | `addDoctor:116`, `changeAvailability:236`, `appointmentsAdmin:254`, `adminDashboard:272` | `BLOCKED` | `adminToken` | — | Depends on #36 | Excluded from voice scope |

### 2.8 Cross-cutting

| # | Concern | Finding | Impact on this feature | Outcome |
|---|---|---|---|---|
| 38 | Localization | **None.** No i18n library; 12 `toLocale*` calls only | Multilingual is built from scratch. Language is a **session-level** property: STT locale, LLM reply language, and TTS voice must all agree | Build: language detection + per-session locale |
| 39 | Accessibility | No a11y tooling or audit in repo | A voice interface *is* an accessibility surface — needs keyboard-reachable activation, visible transcript, and a non-audio path for every voice-only affordance | Build to WCAG; no existing baseline to inherit |
| 40 | Tests | **None** | Nothing to regress against, and no harness to prove the feature works | Verification must be manual + a purpose-built harness |
| 41 | Deployment | `node server.js` in a 4-stage Docker image; Redis optional with in-memory fallback | Voice sockets fit the existing server. **Constraint:** a voice session is stateful, so multi-instance deployment needs sticky sessions or Redis-backed session state — the same class of problem the signaling adapter already solves | Reuse the Redis adapter pattern |
| 42 | Secrets | `.env`/`.env.local` gitignored; `.env.example` holds placeholders only | New keys follow the same pattern | Add voice keys to `.env.example` as placeholders |

---

## 3. Outcome summary

Every user-facing feature discovered has exactly one assigned outcome — none omitted, none claimed as supported where the backing integration is unfinished.

| Outcome | Count | Items |
|---|---|---|
| **Voice support** (read and/or act via existing logic) | 22 | 3–11, 13, 14, 17–19, 21, 22, 24–28 |
| **Guided navigation** (agent explains/navigates, user completes) | 9 | 1, 2, 12, 15, 16, 20, 30, 31, and doctor-side 35 |
| **Documented blocker** | 6 | 12 (payment modal), 15 (no reschedule action), 23 (no lab-report data source), 29 (no notification store), 36–37 (admin by design) |
| **Deferred to later phase** (built, risk-gated) | 5 | 32–35 doctor surfaces, incl. 34 dictation as draft-only |

### Blockers requiring a decision

| Blocker | Why it blocks | Recommendation |
|---|---|---|
| Razorpay checkout (#12) | Browser SDK modal; card/UPI capture over voice is not acceptable | Voice books the slot, then hands off to the existing checkout UI. Agent confirms payment status by reading `Appointment.payment` |
| No reschedule action (#15) | Cancel + rebook is non-atomic — the patient can lose their original slot | Implement a real `rescheduleAppointment` action in one `$transaction`, mirroring `bookAppointment`'s `SLOT_TAKEN` guard. Until then, voice states the risk before cancelling |
| Simulated streaming (#25) | 50ms/word *after* full generation adds seconds before first audio | Voice path bypasses `/api/chat`'s fake stream and consumes `GeminiService` output directly |
| ~~Slot logic in the view layer (#10)~~ | **Not a blocker — audit correction.** `src/lib/schedule.ts` is already the shared source of truth | None; reuse it as-is |

### Prerequisites carried into Phase 2

1. ~~Extract slot generation~~ — already done in `src/lib/schedule.ts`. Voice must reuse `formatSlotTime` verbatim, because booked slots are stored and compared as `hh:mm AM/PM` en-US strings.
2. Typed wrappers over the `FormData` actions the agent calls (#5, #6, #35).
3. Session-level language state — STT locale, reply language, TTS voice kept in sync (#38).
4. Microphone ownership contract between the voice agent and WebRTC (#16).
5. Confirmation protocol for every `ACT`: spoken read-back, then explicit yes, before the mutation.
6. Emergency interrupt wired to `SeverityClassifier` `EMERGENCY` (#26).

### Architecture implied by the audit

Build on what already exists rather than beside it: **Gemini Live API** (present in `@google/genai@2.10.0`) for multilingual native-audio dialog with function calling, carried over a **Socket.IO namespace on the existing `server.js`**, with tools that are thin adapters onto the **39 existing server actions** registered through the existing **`ToolRegistry`**. No new service, no duplicated business logic, no second source of truth for availability or booking.
