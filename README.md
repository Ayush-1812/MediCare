# 🏥 MediCare — AI-Powered Telemedicine Platform

A full-stack healthcare platform where patients book doctors, consult over peer-to-peer video, digitise prescriptions with OCR, find nearby pharmacies, and chat with **Aether AI** — a medical assistant grounded in their own records.

Built with **Next.js 16**, **React 19**, **TypeScript**, **PostgreSQL/Prisma**, **WebRTC**, and the **Google Gemini API**.



## 📋 Table of Contents

- [Problem](#-problem)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [High-Level Architecture](#-high-level-architecture)
- [How Video Consultation Works](#-how-video-consultation-works)
- [How Aether AI Works](#-how-aether-ai-works)
- [Data Model](#-data-model)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Running with Docker](#-running-with-docker)
- [Security](#-security)
- [Roadmap](#-roadmap)

---

## ⚠️ Problem

Healthcare access is fragmented:

- Booking an appointment means phone calls and manual coordination.
- Prescriptions are paper-based, easy to lose, and hard to search.
- After a late-night consultation, there's no quick way to find an open pharmacy.
- Patients have no always-available assistant for general health questions.
- Video consultation is usually either expensive or bolted on badly.

MediCare brings these into one platform, with a role-separated experience for **patients**, **doctors**, and **admins**.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔐 **Role-Based Auth** | JWT sessions in httpOnly cookies, with separate patient / doctor / admin roles and route-level enforcement |
| 📅 **Appointment Booking** | Browse by speciality, see live slot availability, book and cancel — slot conflicts prevented by a DB transaction |
| 🎥 **Video Consultation** | Peer-to-peer WebRTC calls with screen share, fullscreen, and a Google-Meet-style UI |
| 📝 **Consultation Records** | Doctors write diagnosis, prescription and private notes; patients keep their own private notes |
| 📄 **Prescription OCR** | Upload a prescription image → Tesseract.js extracts text → fuzzy-matched against a medicine list |
| 🗺️ **Nearby Pharmacies** | Geolocation → SerpAPI → results sorted by true haversine distance from the user |
| 🤖 **Aether AI** | Gemini-powered assistant with intent routing, tool-based retrieval over real records, and conversation memory |
| 💳 **Online Payments** | Razorpay checkout with server-side HMAC-SHA256 signature verification, plus a pay-at-clinic option |
| 📧 **Email Notifications** | Nodemailer confirmations to both patient and doctor, sent after the booking commits |
| 🛡️ **Admin Panel** | Platform-wide management of doctors and appointments |

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** (App Router, Server Actions, Middleware)
- **React 19**
- **TypeScript 5**
- **Tailwind CSS 4**
- **lucide-react** (icons), **react-toastify** (notifications), **react-markdown**

### Backend & Data
- **Next.js Server Actions** + **Route Handlers** (REST)
- **Node.js** custom server (hosts Next + the WebSocket signalling layer)
- **PostgreSQL** (Supabase)
- **Prisma ORM 5**
- **JWT** (`jsonwebtoken`) + **bcryptjs**

### Real-Time & AI
- **WebRTC** — peer-to-peer audio/video
- **Socket.IO** — SDP/ICE signalling
- **Redis** (`ioredis` + `@socket.io/redis-adapter`) — cross-instance signalling
- **Google Gemini 2.5 Flash** (`@google/genai`)
- **Tesseract.js** — prescription OCR

### Services & Infra
- **Razorpay** — payments
- **Cloudinary** — image storage
- **Nodemailer** — transactional email
- **SerpAPI** — pharmacy search
- **Docker** + **docker-compose** — multi-stage build, non-root runtime

---

## 🏗️ High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│   React 19 · Next.js App Router · Tailwind                       │
│   Patient UI    │    Doctor Dashboard    │    Admin Panel        │
└───────┬──────────────────┬───────────────────────┬───────────────┘
        │ Server Actions   │ WebSocket             │ WebRTC
        │ + REST           │ (signalling only)     │ (media, P2P)
        ▼                  ▼                       │
┌──────────────────────────────────────────┐       │
│         Node.js Server (server.js)       │       │
│  ┌────────────────────────────────────┐  │       │
│  │ Next.js  – SSR, Server Actions     │  │       │
│  │ Middleware – role-based routing    │  │       │
│  └────────────────────────────────────┘  │       │
│  ┌────────────────────────────────────┐  │       │
│  │ Socket.IO – authenticated rooms    │  │       │
│  │   · verifies JWT on handshake      │  │       │
│  │   · relays SDP / ICE only          │  │       │
│  └────────────────────────────────────┘  │       │
└───┬──────────────┬──────────────┬────────┘       │
    │              │              │                │
    ▼              ▼              ▼                ▼
┌────────┐   ┌──────────┐   ┌──────────┐   ┌───────────────┐
│Postgres│   │  Redis   │   │ External │   │  Other Peer   │
│ Prisma │   │ pub/sub  │   │ Services │   │ (direct media)│
└────────┘   └──────────┘   └──────────┘   └───────────────┘
                             Gemini · Razorpay
                             Cloudinary · SerpAPI · SMTP
```

**Key architectural point:** media never touches the server. Socket.IO carries only the few hundred bytes needed to introduce two browsers to each other; video and audio then flow directly peer-to-peer. Redis fans signalling events across instances so the app scales horizontally.

---

## 🎥 How Video Consultation Works

```
Doctor                     Signalling Server                    Patient
  │                                │                               │
  │──── connect (JWT cookie) ─────▶│◀──── connect (JWT cookie) ────│
  │                                │  verifies session +           │
  │                                │  appointment membership       │
  │                                │                               │
  │◀─────── peer-joined ───────────│──────── peer-joined ─────────▶│
  │                                │                               │
  │──────── SDP offer ────────────▶│───────── SDP offer ──────────▶│
  │◀─────── SDP answer ────────────│◀──────── SDP answer ──────────│
  │◀────── ICE candidates ────────▶│◀────── ICE candidates ───────▶│
  │                                │                               │
  │═══════════ direct peer-to-peer audio / video ═════════════════▶│
  │                                │                               │
  │─── consultation-ended ────────▶│──── consultation-ended ──────▶│
```

Design decisions worth noting:

- **Fixed roles** — the doctor is always the caller, the patient always the callee. This removes SDP "glare" entirely, so neither side needs perfect-negotiation rollback logic.
- **ICE candidate queueing** — candidates routinely arrive before the remote description exists. Applying one early throws and the call silently never connects, so they're buffered until the description is set.
- **Room slots by identity, not headcount** — one doctor slot and one patient slot. A duplicate tab or reconnect evicts its own stale socket instead of being refused, so a lingering connection can never lock out the real participant.
- **Dual end-of-call signalling** — a real-time socket event ends the call instantly, with polling as a fallback if that event is missed.

---

## 🤖 How Aether AI Works

```
User message
     │
     ▼
┌──────────────┐   keyword + intent matching
│ IntentRouter │──────────────────────────────┐
└──────────────┘                              │
     │ selects tools                          │
     ▼                                        │
┌──────────────┐   real Prisma queries        │
│ ToolRegistry │   scoped to this patient     │
│  · Appointment · Prescription               │
│  · Timeline    · Profile · HealthSummary    │
│  · SymptomAssessment (+ severity classifier)│
└──────────────┘                              │
     │ tool results                           │
     ▼                                        ▼
┌────────────────┐              ┌──────────────────────┐
│ ContextBuilder │─────────────▶│    PromptManager     │
│ strips IDs,    │              │ system + intent      │
│ nulls, secrets │              │ prompts + history    │
└────────────────┘              └──────────────────────┘
                                          │
                                          ▼
                                ┌──────────────────────┐
                                │  Gemini 2.5 Flash    │
                                │  temp 0.3, streamed  │
                                └──────────────────────┘
                                          │
                                          ▼
                                  Grounded response
```

The assistant answers **only** from the patient's real records. Where MediCare has no data source for a category (e.g. lab reports), the tool says so explicitly rather than letting the model invent plausible-looking results — an important property for a healthcare assistant.

---

## 🗄️ Data Model

```
User ──────┬──< Appointment >──┬────── Doctor
           │                   │
           │                   └── diagnosis, prescription,
           │                       notes (doctor-private),
           │                       patientNotes (patient-private),
           │                       meetingId, duration, payment
           │
           ├──< Prescription        (OCR image + extracted medicines)
           │
           └──< Conversation ──< Message   (Aether AI chat history)
```

Six models: `User`, `Doctor`, `Appointment`, `Prescription`, `Conversation`, `Message`.

Note the deliberate symmetry on `Appointment`: `notes` is the doctor's private field and `patientNotes` is the patient's. Each is stripped server-side before the other party ever receives it — privacy enforced in the data layer, not just hidden in the UI.

---

## 📂 Project Structure

```
medicare/
├── server.js                  # Custom Node server: Next.js + Socket.IO signalling
├── prisma/schema.prisma       # Database schema
├── src/
│   ├── app/
│   │   ├── actions/           # Server Actions (user, doctor, admin, consultation, payment)
│   │   ├── api/               # Route Handlers (chat, health checks, pharmacies)
│   │   ├── admin/             # Admin panel
│   │   ├── doctor-dashboard/  # Doctor portal
│   │   ├── video-call/        # Consultation room
│   │   └── ...                # Patient-facing pages
│   ├── components/            # Shared UI (VideoCallStage, ConsultationPanel, …)
│   ├── lib/
│   │   ├── ai/                # Aether AI: orchestrator, tools, prompts, Gemini service
│   │   ├── webrtc/            # useWebRTCCall hook
│   │   ├── payment/           # Razorpay checkout loader
│   │   ├── mail/              # Email templates + transport
│   │   ├── auth.ts            # JWT session helpers
│   │   └── rateLimit.ts       # Auth endpoint throttling
│   └── middleware.ts          # Role-based route protection
└── docker-compose.yml
```

---

## ⚙️ Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL (or a Supabase project)
- API keys: Google Gemini, Cloudinary, SerpAPI, Razorpay (optional), SMTP (optional)

### Setup

```bash
# 1. Clone and install
git clone <your-repo-url>
cd medicare
npm install

# 2. Configure environment
cp .env.example .env
#    Fill in at minimum: DATABASE_URL, JWT_SECRET, GEMINI_API_KEY

# 3. Push the schema to your database
npx prisma db push

# 4. Start
npm run dev
```

Open <http://localhost:3000>.

> **Note:** video consultation requires the custom server (`node server.js`), which hosts the Socket.IO signalling layer. Plain `next dev` serves every other feature but cannot host WebSockets.

---

## 🔑 Environment Variables

See `.env.example` for the full annotated list. Essentials:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Signs session tokens |
| `GEMINI_API_KEY` | ✅ | Aether AI |
| `CLOUDINARY_*` | ✅ | Profile photos, prescription images |
| `SERPAPI_KEY` | ✅ | Nearby pharmacy search |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` | ✅ | Admin login (bcrypt hash preferred) |
| `APP_URL` | ⬜ | Base URL used in email links |
| `SMTP_*` | ⬜ | Email notifications — bookings still succeed without it |
| `RAZORPAY_KEY_ID` / `_SECRET` | ⬜ | Online payments — falls back to pay-at-clinic |
| `REDIS_URL` | ⬜ | Multi-instance signalling; single instance works without it |
| `TURN_URLS` / `TURN_USERNAME` / `TURN_CREDENTIAL` | ⬜ | Relay for restrictive networks (see below) |

Optional keys degrade gracefully — a missing SMTP host logs the skipped email instead of failing the booking.

---

## 🐳 Running with Docker

```bash
cp .env.example .env      # fill in JWT_SECRET, GEMINI_API_KEY, ADMIN_PASSWORD_HASH …
docker compose up --build
```

Brings up the app and a PostgreSQL instance. The image uses a multi-stage build and runs as a non-root user; `RUN_DB_PUSH=true` syncs the schema on boot for the bundled database.

---

## 🔒 Security

- **JWT sessions in httpOnly cookies** — not readable from JavaScript; the `role` claim is verified, so a patient token cannot be replayed as a doctor's.
- **Authorization at the action layer** — Server Actions are POST endpoints callable by anyone, so every privileged action verifies the session itself rather than trusting the UI.
- **Role-based middleware** — `/admin/*` requires an admin session, `/doctor-dashboard/*` a doctor session.
- **Rate limiting** — login and registration are throttled per account to blunt brute-force attempts.
- **bcrypt password hashing**, with constant-time comparison on the admin credential path.
- **Payment integrity** — Razorpay callbacks are verified by recomputing the HMAC-SHA256 signature server-side; the client's "success" callback is never trusted on its own.
- **Data minimisation** — server responses strip fields the requester shouldn't see (doctor's private notes, patient's private notes, password hashes).

---

## 🗺️ Roadmap

- [ ] TURN server for reliable connections on restrictive networks — without one, roughly 10–20% of peer pairs (symmetric NAT, corporate firewalls) can't establish a direct path
- [ ] Automated test suite (unit + E2E)
- [ ] Doctor ratings and reviews
- [ ] Appointment reminders and cancellation emails
- [ ] Multi-participant consultations
- [ ] Structured audit logging

---

## 📄 License

Released under the MIT License.
