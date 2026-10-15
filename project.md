# 🏥 MediCare — Complete Project Documentation

> **For Interviews, Code Reviews & Personal Reference**
> This document covers every feature, every tech choice, the system design, scaling strategy, and answers to every question an interviewer might ask — all in plain, simple language.

---

## 📌 Table of Contents

1. [What is MediCare?](#1-what-is-medicare)
2. [Tech Stack & Why Each Technology Was Chosen](#2-tech-stack--why-each-technology-was-chosen)
3. [High-Level Architecture (HLD)](#3-high-level-architecture-hld)
4. [Database Design](#4-database-design)
5. [Feature Deep-Dive](#5-feature-deep-dive)
6. [Security Design](#6-security-design)
7. [Scaling & Future Architecture](#7-scaling--future-architecture)
8. [Interview Questions & Answers](#8-interview-questions--answers)

---

## 1. What is MediCare?

MediCare is a **full-stack telemedicine web application** — think of it as a simplified "online hospital."

**What a patient can do:**
- Register/login securely
- Browse doctors by speciality
- Book a consultation slot and pay online
- Join a live video call with the doctor
- Upload and scan prescription images using OCR
- Chat with an AI health assistant named **Aether**
- View appointment history and consultation summaries
- Find nearby pharmacies

**What a doctor can do:**
- Login to their personal dashboard
- See their upcoming and past appointments
- Join the video consultation room
- Write diagnosis, prescription, and private notes during a call
- Set follow-up dates for patients

**What an admin can do:**
- Login to a separate admin panel
- Add/remove doctors
- Toggle doctor availability
- View all appointments and platform statistics

---

## 2. Tech Stack & Why Each Technology Was Chosen

### Frontend

| Technology | Why Used |
|---|---|
| **Next.js 16** | Full-stack React framework. Gives us SSR, Server Actions, API routes, and file-based routing all in one. No separate Express backend needed for most things. |
| **React 19** | Industry-standard UI library. Hooks make state management clean. |
| **TypeScript** | Catches bugs before runtime. Gives autocomplete. Saves hours of debugging. |
| **TailwindCSS v4** | Utility-first CSS. Rapid styling without writing custom CSS files. |
| **Lucide React** | Clean, consistent icon library that matches modern UI standards. |
| **React Toastify** | Simple toast notifications for user feedback. |
| **React Markdown** | Renders the AI assistant's markdown-formatted replies properly. |

### Backend

| Technology | Why Used |
|---|---|
| **Next.js Server Actions** | Instead of building a separate REST API for forms, Server Actions let us write server-side functions that the UI calls directly. Secure by default — they run on the server, never in the browser. |
| **Custom Node.js Server (server.js)** | Next.js's built-in `next start` cannot host a WebSocket server. We need WebSockets for real-time video signaling, so a custom Node HTTP server wraps Next.js and adds Socket.IO on top. |
| **Socket.IO** | Real-time, bidirectional communication for the WebRTC signaling channel (passing SDP offers/answers and ICE candidates between doctor and patient). |
| **JWT (jsonwebtoken)** | Stateless session tokens. The server signs a token on login and stores it as an httpOnly cookie. Every request that needs auth reads this cookie. |
| **bcryptjs** | Secure password hashing. Passwords are never stored in plain text. |

### Database

| Technology | Why Used |
|---|---|
| **PostgreSQL** | Relational database — appointments, users, doctors, prescriptions all have relationships. A SQL database enforces referential integrity (you can't book an appointment for a doctor that doesn't exist). |
| **Prisma ORM** | Type-safe database client. Writing `prisma.user.findMany()` is much safer than raw SQL strings where a typo causes a runtime crash. Also manages migrations. |

### AI / ML

| Technology | Why Used |
|---|---|
| **Google Gemini (@google/genai)** | Powers the Aether AI health assistant. Gemini is chosen because it's strong at following clinical context instructions and is cost-effective. |
| **Tesseract.js** | OCR (Optical Character Recognition) — reads text from prescription images right in the browser, so the image never needs to be sent to a server just for text extraction. |
| **string-similarity** | Fuzzy matching library used in the prescription parser to match OCR-garbled drug names (e.g. "Pantopragole" to "Pantoprazole"). |

### Payments

| Technology | Why Used |
|---|---|
| **Razorpay** | Most popular payment gateway in India. Supports UPI, cards, netbanking. The server creates a Razorpay Order and verifies the HMAC signature after payment — the client callback alone is never trusted. |

### Media Storage

| Technology | Why Used |
|---|---|
| **Cloudinary** | Cloud image hosting for doctor profile photos and prescription scans. Images are uploaded once and served via CDN. Fallback to inline base64 (with size cap) if Cloudinary is not configured. |

### Email

| Technology | Why Used |
|---|---|
| **Nodemailer** | Sends appointment confirmation emails via any SMTP server. Designed to be non-blocking — if email fails, the booking still succeeds (email is a notification, not a transaction). |

### Real-time Infrastructure

| Technology | Why Used |
|---|---|
| **Redis (ioredis)** | Used as the Socket.IO adapter so that if we run multiple app instances (horizontal scaling), all instances share the same Socket.IO rooms. Without Redis, a doctor on Server A and patient on Server B would never connect. |
| **@socket.io/redis-adapter** | The bridge that makes Socket.IO use Redis for pub/sub across instances. |

### DevOps

| Technology | Why Used |
|---|---|
| **Docker + Docker Compose** | The entire stack (app + postgres + redis) runs with `docker compose up`. Reproducible across any machine. |

---

## 3. High-Level Architecture (HLD)

```
+-------------------------------------------------------------+
|                         BROWSER                              |
|                                                              |
|  +--------------+  +--------------+  +------------------+   |
|  |  Patient UI  |  |  Doctor UI   |  |   Admin Panel    |   |
|  +--------------+  +--------------+  +------------------+   |
|         |                 |                     |            |
|         +--------HTTP / WebSocket (Socket.IO)---+            |
+-------------------------------+------------------------------+
                                |
                +---------------v------------------+
                |        Custom Node Server         |
                |         (server.js)               |
                |                                   |
                |  +--------------------------+     |
                |  |      Next.js App         |     |
                |  |  (pages / API / Actions) |     |
                |  +--------------------------+     |
                |                                   |
                |  +--------------------------+     |
                |  |      Socket.IO           |     |
                |  |  (WebRTC signaling)      |     |
                |  +--------------------------+     |
                +----------+------------------------+
                           |
         +-----------------+------------------+
         |                 |                  |
  +------v------+   +------v-----+   +--------v------+
  | PostgreSQL  |   |   Redis    |   |  Cloudinary   |
  |  (Prisma)   |   |  (pub/sub) |   |  (image CDN)  |
  +-------------+   +------------+   +---------------+
         |
  +------v------+
  |  Gemini AI  |
  |   (Aether)  |
  +-------------+
```

### Request Flow — Booking an Appointment

```
Patient clicks "Book Slot"
        |
        v
Next.js Server Action (bookAppointment in userActions.ts)
        |
        v
Checks JWT cookie → gets userId
        |
        v
Validates slot availability in PostgreSQL
        |
        v
Creates Appointment row in DB
        |
        v
Sends confirmation email via Nodemailer (non-blocking)
        |
        v
Returns success + revalidates cached pages
        |
        v
Patient sees updated appointment list
```

### Video Call Flow

```
Doctor clicks "Start Consultation"
        |
        v
startConsultation() Server Action → writes startTime + meetingId to DB
        |
        v
Doctor's browser opens VideoCallStage → useWebRTCCall hook
        |
        v
1. Camera/mic acquired via getUserMedia()
2. ICE servers fetched from server
3. Socket.IO connects to /api/socket (signaling server)
        |
        v
Patient joins → Socket.IO notifies doctor ("peer-joined")
        |
        v
Doctor sends SDP Offer → relayed via Socket.IO → Patient answers
        |
        v
ICE candidates exchanged → WebRTC P2P media channel established
        |
        v
(Media flows directly between browsers — server never touches video/audio)
        |
        v
Doctor submits consultation form → endConsultation() Server Action
        |
        v
Socket.IO broadcasts "consultation-ended" → patient redirected to summary
```

---

## 4. Database Design

We have **6 models** in Prisma:

### User (patients)
```
id, name, email, password (hashed), image, address, gender, dob, phone
heightCm, weightKg, bloodGroup, allergies   <- Health profile (optional)
has many: Appointments, Prescriptions, Conversations
```

### Doctor
```
id, name, email, password (hashed), speciality, degree, experience
consultationModes, availableDays, slotStartTime, slotEndTime, slotDuration
fees, available (bool), profileCompleted (bool)
slots_booked (JSON) — tracks which date+time slots are taken
has many: Appointments
```

### Appointment
```
id, userId -> User, docId -> Doctor
slotDate, slotTime, amount, payment (bool)
cancelled (bool), isCompleted (bool)
meetingId — the WebRTC room name
startTime, endTime, duration — call timing
diagnosis, prescription, notes (doctor-only), patientNotes (patient-only)
followUpDate
userData (JSON snapshot), docData (JSON snapshot)
```

> **Why JSON snapshots?** If a doctor changes their name after an appointment, the appointment history should still show the original doctor's name. Snapshots freeze the data at booking time.

### Prescription
```
id, userId -> User
imageUrl, rawText (OCR output), medicines (JSON array), notes
ocrEngine, ocrConfidence, isVerified
```

### Conversation + Message (AI Chat)
```
Conversation: id, userId, title, lastMessageAt
Message: id, conversationId, role (USER/ASSISTANT/SYSTEM/TOOL), content, model, toolUsed, tokenUsage
```

Each conversation stores full message history so the AI has context across sessions.

---

## 5. Feature Deep-Dive

### 5.1 Authentication System

Three separate roles with separate cookies:

| Role | Cookie Name | What It Does |
|---|---|---|
| Patient | `token` | Accesses patient pages |
| Doctor | `docToken` | Accesses doctor dashboard |
| Admin | `adminToken` | Accesses admin panel |

**How it works:**
1. User logs in → server verifies password with `bcrypt.compare()`
2. Server signs a JWT: `{ id, role }` with `JWT_SECRET`
3. JWT is stored as an `httpOnly` cookie (JavaScript cannot read it — XSS-proof)
4. Every server action calls `getSessionId(role)` which reads and verifies the cookie
5. The `role` claim in the JWT is checked — a patient's token cannot be used as a doctor token even if the JWT signature is valid

**Middleware** protects page routes:
- `/admin/*` requires `adminToken`
- `/doctor-dashboard/*` requires `docToken`
- Everything else requires any valid session

**Rate Limiting** on login endpoints:
- Fixed-window counter per email
- Admin: 5 attempts per 15 minutes
- Successful login clears the counter

### 5.2 Appointment Booking

1. Patient picks a doctor and sees available time slots
2. Slots are computed from `slotStartTime`, `slotEndTime`, `slotDuration` and filtered against `slots_booked` JSON
3. Patient books → slot is added to `slots_booked` JSON on the Doctor record
4. Optional: Patient pays online via Razorpay before the appointment
5. Confirmation email sent (non-blocking)

**Why `slots_booked` is a JSON on the Doctor instead of a separate table?**
Reading/writing a single JSON column is faster than querying a join table for simple slot availability checks.

### 5.3 Payment with Razorpay

The secure flow that prevents fraud:

1. `createPaymentOrder()` Server Action creates a Razorpay Order on the server with the exact appointment fee
2. Client opens Razorpay popup (only Razorpay's script can open this)
3. Patient pays → Razorpay returns `orderId + paymentId + signature` to the client callback
4. Client calls `verifyPayment()` Server Action with those three values
5. Server **recomputes the HMAC-SHA256 signature** using Razorpay's secret and compares — if it doesn't match, the payment is rejected
6. Only then is the appointment marked `payment: true` in the database

**Why this matters:** Without step 4-5, someone could fake the "success" callback and mark any appointment as paid for free.

### 5.4 Video Consultation (WebRTC)

**What is WebRTC?**
WebRTC is a browser standard that lets two browsers send audio/video directly to each other without going through a server. It's what Google Meet and Zoom are based on.

**Our solution:**
- **Socket.IO** on the custom Node server acts as the signaling relay
- **Doctor is always the caller, patient is always the answerer** — this prevents "SDP glare"
- **STUN** (from Google) helps browsers find their public IP
- **TURN** (configurable) relays media when a direct connection is impossible
- **Redis adapter** on Socket.IO means the signaling works even when multiple app instances are running

**Screen sharing:** Uses `getDisplayMedia()` and replaces the video track on the existing peer connection (no renegotiation needed).

**Security:** The Socket.IO middleware verifies that the connecting socket is either the doctor or patient named on that appointment.

### 5.5 AI Health Assistant (Aether)

The assistant uses a **pipeline architecture**:

```
User message
     |
     v
IntentRouter — keyword matching decides what the user is asking about
     |
     v
ToolRegistry — loads the right tools (AppointmentTool, PrescriptionTool, etc.)
     |
     v
Each Tool queries PostgreSQL for REAL patient data
     |
     v
ContextBuilder — assembles the tool results into structured context
     |
     v
PromptManager — builds the full prompt with system instructions + context + history
     |
     v
GeminiService — calls Google Gemini API
     |
     v
ResponseFormatter — cleans up the response
     |
     v
Streamed back to the patient word-by-word
```

**Available Tools:**

| Tool | What it fetches |
|---|---|
| `AppointmentTool` | Patient's upcoming/past appointments |
| `PrescriptionTool` | Scanned prescriptions + doctor-prescribed medicines |
| `TimelineTool` | Chronological list of completed consultations |
| `ProfileTool` | Patient's health profile (height, weight, blood group, allergies) |
| `HealthSummaryTool` | Computed BMI + most recent diagnosis |
| `ReportTool` | Honestly says "not supported" — no fake lab results |
| `SymptomAssessmentTool` | Extracts symptoms, severity, allergies, medication history |

**Important design decision:** Tools never fabricate data. If no data exists for a category, they explicitly say so.

**Conversation memory:** Last 10 messages are fetched before each response.

### 5.6 Prescription OCR Pipeline

1. Patient takes a photo in the browser
2. **Tesseract.js** runs OCR in the browser (no upload needed for text extraction)
3. **`parsePrescription()`** splits the raw text:
   - Identifies medicine lines by dose forms ("Tab.", "Syp."), dosage patterns ("500mg"), frequency patterns ("OD", "BD", "1-0-1")
   - Separates advice/notes from prescriptions
   - Fuzzy-matches drug names against a medicine database to fix OCR typos
4. **(Optional)** Gemini AI does a second pass to catch names Tesseract mangled
5. Patient reviews the result, makes corrections, then saves
6. Image uploaded to **Cloudinary**; structured data saved to PostgreSQL

**Fallback:** If Gemini is unavailable, the parser result is used. The prescription feature never breaks completely.

### 5.7 Nearby Pharmacies

- Uses SerpAPI to find pharmacies near the patient's location
- Browser geolocation API gets patient's coordinates
- Results fetched via a Next.js API route so the SerpAPI key is never exposed to the client

### 5.8 Email Notifications

**Nodemailer** sends appointment confirmation emails with:
- Appointment date, time, doctor name
- A link to join the video call

**Resilience design:**
- 3 retry attempts with exponential backoff
- Distinguishes retryable (4xx SMTP, network timeout) vs. permanent failures (5xx, bad address)
- If SMTP is not configured, it logs what would have been sent and the booking succeeds anyway

### 5.9 Admin Panel

The admin is a **single hardcoded account** (credentials in environment variables):
- `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (bcrypt) or `ADMIN_PASSWORD` (plaintext, legacy)
- No admin account in the database — can't be compromised via SQL injection
- Timing-safe email comparison to prevent user-enumeration attacks

Admin capabilities:
- Add new doctors (with photo upload to Cloudinary)
- Toggle doctor availability on/off
- View all appointments
- Dashboard statistics (doctor count, patient count, appointment count)

---

## 6. Security Design

| Concern | Solution |
|---|---|
| Password storage | bcrypt with salt factor 10 |
| Session tokens | httpOnly JWT cookies (XSS cannot steal them) |
| Role confusion | JWT includes `role` claim — doctor token cannot authenticate as patient |
| CSRF | SameSite=Lax cookies + Server Actions (POST only) |
| Brute force | Rate limiting on login/signup endpoints |
| Timing attacks | `timingSafeEqual` for admin credential comparison |
| Authorization bypass | Every Server Action independently verifies the session cookie |
| Sensitive data leakage | `getConsultationDetails` strips doctor notes from patient response server-side |
| Payment fraud | HMAC-SHA256 signature verification of Razorpay callback |
| WebRTC room crashers | Socket.IO middleware verifies appointment ownership before joining any room |
| Raw error leakage | All Server Actions catch errors and return a generic message; real error logged server-side only |
| Image size limits | 2MB cap on inline prescription images without Cloudinary |

---

## 7. Scaling & Future Architecture

### Current State (Single Instance)
```
1 Docker container (app + socket.io)
    + PostgreSQL
    + Redis (already in docker-compose)
```

### Scaling Path

**Step 1 — Horizontal App Scaling (Already Designed For)**

Redis is already integrated. Socket.IO uses the Redis adapter so multiple app instances share the same WebRTC signaling rooms.

```
Load Balancer (Nginx / AWS ALB)
         |
+--------+--------+--------+
|        |        |        |
App 1   App 2   App 3    ...
   |        |        |
   +--------+--------+
            |
           Redis (Socket.IO adapter)
            |
       PostgreSQL (connection pool via PgBouncer)
```

**Step 2 — Database Scaling**
- Read replicas for doctor searches and appointment listing
- PgBouncer for connection pooling
- Move to Supabase or Amazon RDS for managed PostgreSQL with automatic failover

**Step 3 — AI Cost Optimization**
- Cache common AI responses in Redis
- Queue AI requests via a job system (BullMQ + Redis) instead of blocking HTTP
- Use Gemini's native streaming API instead of word-splitting simulation

**Step 4 — WebRTC at Scale**
- Add a proper TURN server (Coturn) for networks behind strict firewalls
- Consider a media server (mediasoup) for group calls (currently 1-to-1 only)

**Step 5 — Observability**
- Add structured logging (Pino or Winston)
- Metrics with Prometheus + Grafana
- Error tracking with Sentry

**Step 6 — Rate Limiting at Scale**
- Move in-process rate limiter to Redis so all instances share the same counters
- The code is already structured to make this swap easy

### What Would Change vs. Stay Same at Scale

| Component | Stays Same | Changes |
|---|---|---|
| Auth (JWT) | Already stateless | — |
| Database schema | Yes | Connection pooling needed |
| Socket.IO | Already Redis-backed | — |
| Rate limiting | Code stays same | Backing store moves to Redis |
| AI chat | Orchestrator pattern | Add queuing, caching |
| Prescription OCR | Client-side Tesseract | — |
| Payments | Stateless HMAC verify | — |

---

## 8. Interview Questions & Answers

### Authentication & Security

**Q1: How does authentication work in your app?**

When a user logs in, the server verifies their password using bcrypt, then signs a JWT containing their `id` and `role`. This JWT is set as an `httpOnly` cookie so JavaScript can't read it (protecting against XSS). Every server-side action reads this cookie and verifies both the JWT signature and the role claim. There are three separate cookies for three roles — patient, doctor, and admin — and a patient's token cannot be used to access doctor routes.

**Q2: What is the difference between middleware auth and Server Action auth?**

Middleware runs on the Edge and only checks if a cookie *exists* — it can't verify the JWT signature because the `jsonwebtoken` library doesn't run on the Edge runtime. It's a fast UI-layer guard that redirects users to the login page. Server Actions are the *real* security — they run on the server, verify the JWT signature, check the role claim, and confirm the user is authorized for the specific data they're requesting.

**Q3: How do you prevent brute-force attacks on login?**

A fixed-window rate limiter counts login attempts per email address within a time window. If a user exceeds the limit, further attempts are rejected with a "retry after X seconds" message. After a successful login, the counter is reset so legitimate users don't get locked out. The admin endpoint has tighter limits (5 attempts per 15 minutes) since it's the highest-value target.

**Q4: How do you verify Razorpay payments securely?**

The server creates a Razorpay Order with the exact appointment fee. After the customer pays, Razorpay returns three values: `orderId`, `paymentId`, and a `signature`. The server recomputes the expected signature using HMAC-SHA256 with Razorpay's secret key over `orderId|paymentId`. If the computed signature matches the one Razorpay sent, the payment is genuine. This prevents anyone from faking a payment by calling our verification endpoint with made-up values.

---

### Architecture

**Q5: Why did you use a custom Node server instead of Next.js's built-in server?**

Next.js's `next start` runs behind a Node HTTP server but doesn't expose it for modification. We need WebSockets for real-time signaling in the video call (Socket.IO). The custom `server.js` wraps Next.js and attaches Socket.IO to the same HTTP server, so both HTTPS requests (Next.js) and WebSocket connections (Socket.IO at `/api/socket`) are handled on port 3000.

**Q6: Why use Server Actions instead of a separate REST API?**

Server Actions are TypeScript functions marked with `'use server'`. When the client calls them, Next.js internally makes a POST request. The benefits: type-safety across the client-server boundary, automatic serialization, no need to write separate API routes for CRUD operations, and they have direct access to server-side context (cookies, database).

**Q7: Why PostgreSQL instead of MongoDB?**

Our data is highly relational — an appointment relates to a user and a doctor, a prescription relates to a user, a message relates to a conversation which relates to a user. PostgreSQL enforces these relationships with foreign keys, preventing orphan records. It also gives us ACID transactions. MongoDB would require us to manually enforce these constraints in application code.

**Q8: Why did you use Prisma instead of raw SQL or another ORM?**

Prisma gives us type-safe database queries — if we write `prisma.user.findMany({ select: { name: true } })`, TypeScript knows the result has a `name` field. A typo in a column name is caught at compile time, not at 2am during an outage. It also manages migrations and generates clean SQL.

---

### Video Calls (WebRTC)

**Q9: Explain how the video call works technically.**

WebRTC is a peer-to-peer protocol. Two browsers can send video directly to each other, but first they need to "introduce" themselves — exchange network addresses and codec capabilities. This introduction is called "signaling." Our Socket.IO server acts as the signaling relay. Here's the flow:
1. Doctor and patient both connect to the Socket.IO server with their appointment ID
2. The doctor sends an SDP "offer" (a description of what codecs it supports and how to reach it)
3. Socket.IO relays this to the patient
4. Patient responds with an SDP "answer"
5. Both sides exchange ICE candidates (potential network paths)
6. The browsers find the best direct path and establish a peer-to-peer connection
7. From that point, media flows directly between browsers — our server sees nothing

**Q10: What is STUN and TURN and why do you need them?**

STUN (Session Traversal Utilities for NAT) helps a browser discover its own public IP address — browsers behind home routers have private IPs and need to know their public IP to share with the other side. TURN (Traversal Using Relays around NAT) is a fallback relay for when a direct connection is impossible (symmetric NAT, corporate firewalls). Our app uses Google's public STUN servers by default and supports configurable TURN servers. Without TURN, calls fail on strict networks.

**Q11: Why is the doctor always the caller and not the patient?**

In WebRTC, both sides trying to create an offer at the same time causes "SDP glare" — both sides receive an offer while in the middle of making one, and neither knows how to resolve the conflict. By fixing the role (doctor = caller, patient = answerer), we eliminate glare entirely.

**Q12: What happens when the same person opens the video call in two tabs?**

The Socket.IO server detects that a new socket is connecting with the same role in the same room. It sends a "replaced" event to the older socket, disconnects it, and lets the new one in. This prevents the room from being "full" with stale connections from a previous tab or a network blip.

---

### AI (Aether)

**Q13: How does the AI assistant work?**

It's a pipeline:
1. **Intent Router**: Keyword matching classifies the user's message into intents (appointment, prescription, health summary, symptom assessment, etc.)
2. **Tool Registry**: Based on intent, the right tools are selected
3. **Tool Execution**: Each tool queries the database for the patient's real data
4. **Context Builder**: Tool results are assembled into structured JSON context
5. **Prompt Manager**: A system prompt + context + conversation history + user message are combined
6. **Gemini API**: Generates the response
7. **Response Formatter**: Cleans up the output, then streams it word-by-word

**Q14: Why does the AI have tools that query the database?**

Without real data, the AI would fabricate responses. For a health app, an AI that invents a blood test result the patient never had is dangerous — a patient might make health decisions based on it. The tools ensure the AI only tells the patient things that are actually in their medical record. If data doesn't exist, the tool explicitly says so.

**Q15: How do you handle conversation memory?**

Before generating each response, we fetch the last 10 messages from that conversation from the database and pass them to the Gemini API as "history." This is called "sliding window context." The AI uses this history to understand follow-up questions without needing the patient to repeat context.

---

### Prescription OCR

**Q16: How does the prescription scanner work?**

The patient takes a photo in the browser. Tesseract.js (an OCR library that runs fully in the browser via WebAssembly) reads the text from the image without any server upload. The raw text goes to our prescription parser which identifies medicine lines by looking for dose forms, dosage patterns, and frequency patterns, then fuzzy-matches drug names against a medicine database to fix OCR typos. Optionally an AI (Gemini) does a second pass. The patient reviews and corrects before saving.

**Q17: Why run OCR in the browser instead of the server?**

Privacy and speed. Running Tesseract.js in the browser means the prescription image doesn't leave the patient's device until they explicitly click "Save." This is important for medical data. It's also faster — no round-trip upload needed just for text extraction.

---

### Database & Performance

**Q18: Why do you store `userData` and `docData` as JSON snapshots on Appointment?**

Imagine a doctor changes their name after the patient's appointment. The appointment history should show the original doctor's name. By snapshotting the relevant fields at booking time (name, image, fee), the appointment history is immutable. It's a denormalization trade-off: slightly more storage in exchange for historical accuracy.

**Q19: How do you prevent double-booking?**

The `slots_booked` JSON on each Doctor record tracks which `date+time` slots are taken. Before booking, the server checks if the requested slot is in `slots_booked`. If not, it adds it atomically to prevent race conditions.

**Q20: How does Prisma's `revalidatePath` keep the UI in sync?**

After a Server Action mutates data (e.g., booking an appointment), we call `revalidatePath('/my-appointments')`. Next.js then invalidates its server-side render cache for that path, so the next request for that page fetches fresh data from the database instead of serving stale cached HTML.

---

### Real-time & Scaling

**Q21: Why do you need Redis for Socket.IO?**

Socket.IO keeps "rooms" in the Node process's memory by default. This works fine for a single server. But if we run two app instances and the doctor is on Instance 1 and the patient is on Instance 2, they're in different processes — their signals never reach each other. The Redis adapter makes all instances share the same room state using Redis pub/sub.

**Q22: How would you scale this app for 100,000 users?**

1. **Database**: Move to managed PostgreSQL (RDS/Supabase) with read replicas, add PgBouncer for connection pooling
2. **App**: Run multiple Docker containers behind a load balancer (Redis adapter already handles Socket.IO)
3. **Rate limiting**: Move from in-process counters to Redis so all instances share limits
4. **AI**: Queue requests via Redis/BullMQ instead of blocking HTTP; cache common responses
5. **Media**: Prescription images already go to Cloudinary (CDN)
6. **WebRTC**: Add a TURN server cluster for networks with strict firewalls
7. **Monitoring**: Add Prometheus + Grafana, error tracking with Sentry

**Q23: How does your rate limiter work, and what are its limitations?**

It's a fixed-window limiter stored in-process (Node.js Map). Per email address, it counts attempts within a time window. The limitation: with multiple server instances, each has its own counter, so the effective limit is `limit x number_of_instances`. Moving it to Redis would make it global. The code is already structured to make this swap easy.

---

### Frontend & UX

**Q24: How does the streaming response work for the AI chat?**

The AI generates the full response first (Gemini API call), then we split the text into words and send them one by one using the Web Streams API with a small delay between each word. The browser reads this chunked response and appends words as they arrive, giving the appearance of live generation.

**Q25: Why use Next.js Server Actions instead of a traditional API?**

Server Actions are TypeScript functions that run on the server but can be called directly from React components like regular async functions. Benefits: no need to write `fetch()` calls manually, automatic CSRF protection, type safety across the full stack, and they co-locate with the feature code rather than living in a separate API folder.

---

### Design Decisions

**Q26: Why are doctor's notes and patient notes separate fields?**

Privacy. The doctor's `notes` field contains clinical observations they might not want the patient to see. The patient's `patientNotes` field is their own private writing. The `getConsultationDetails` Server Action enforces this server-side: it sends `notes` only to doctors and `patientNotes` only to patients. Even if someone inspects the network traffic, they only see the fields they're authorized for.

**Q27: Why is `profileCompleted` on the Doctor model `true` by default?**

Doctors added by the admin have all their details filled in at the time of creation — they're immediately visible to patients. Doctors who self-sign-up have `profileCompleted: false` set explicitly, which hides them from the directory until they complete their profile form. The default `true` means existing doctors in the database stay visible without needing a migration to update them.

---

### Healthcare-Specific

**Q28: What would you add to make this production-ready for a real hospital?**

1. **HIPAA/GDPR compliance**: Encrypt PII at rest, add audit logs for who accessed what patient data and when
2. **Video recording consent**: Legal requirement in many jurisdictions
3. **End-to-end encryption**: For chat and notes stored at rest
4. **Prescription digital signatures**: Doctors should digitally sign prescriptions
5. **Multi-factor authentication**: Especially for admin and doctors
6. **Penetration testing**: Healthcare data is the highest-value target for attackers
7. **Proper TURN server**: Corporate hospital networks often can't do P2P WebRTC
8. **Lab report integration**: HL7/FHIR standard for interoperability with hospital systems
9. **Audit trail**: Every read/write to patient data logged with who/when/why

**Q29: How do you handle the case where the doctor submits the consultation while the patient is still on the call?**

When the doctor submits the consultation form, `endConsultation()` marks the appointment as completed and then the doctor's Socket.IO client emits a `consultation-ended` event. The server relays this to the patient's socket immediately. The patient's browser receives this event, tears down the media connection, and redirects to the consultation summary page. This is real-time — the patient doesn't need to poll or wait for a page refresh.

**Q30: Why does the prescription feature have a two-stage pipeline (parser + AI)?**

The parser is deterministic, free, and instant — it handles 80% of cases correctly. The AI pass handles the remaining 20% where OCR quality is poor and drug names are too mangled for fuzzy matching. But AI APIs can fail (outage, quota exhausted, timeout). Having the parser as a primary with AI as an enhancement means the feature never completely breaks. The user always gets some result — it might just need more manual correction.

---

## Key Files Reference

| File | Purpose |
|---|---|
| `server.js` | Custom Node server: Next.js + Socket.IO signaling |
| `prisma/schema.prisma` | All database models |
| `src/lib/auth.ts` | JWT session management |
| `src/middleware.ts` | Route protection |
| `src/lib/webrtc/useWebRTCCall.ts` | WebRTC peer connection hook |
| `src/lib/ai/AIOrchestrator.ts` | AI pipeline coordinator |
| `src/lib/ai/IntentRouter.ts` | Keyword-based intent classification |
| `src/lib/prescriptionParser.ts` | OCR text to structured medicines |
| `src/lib/rateLimit.ts` | Fixed-window login rate limiter |
| `src/lib/payment/razorpayCheckout.ts` | Client-side Razorpay integration |
| `src/app/actions/paymentActions.ts` | Server-side payment verification |
| `src/app/actions/consultationActions.ts` | Start/end video consultation |
| `src/app/actions/adminActions.ts` | Admin CRUD operations |
| `src/lib/mail/mailer.ts` | Resilient SMTP email service |
| `docker-compose.yml` | App + PostgreSQL + Redis stack |

---

*Document generated: September 2026 | MediCare v0.1.0*
