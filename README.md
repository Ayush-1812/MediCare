<<<<<<< Updated upstream

# 🏥 MediCare — AI-Powered Healthcare Platform

=======
<<<<<<< HEAD

# 🏥 MediCare – AI-Powered Healthcare Management Platform

> > > > > > > Stashed changes

> A full-stack, production-grade healthcare platform that lets patients book appointments with doctors, upload and analyse prescriptions via OCR, video-consult their doctor, find nearby pharmacies, and chat with **Aether AI** — an intelligent medical assistant powered by Google Gemini 2.5 Flash.

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [High-Level Architecture](#-high-level-architecture)
- [Folder Structure](#-folder-structure)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Running Locally](#-running-locally)
- [Running with Docker](#-running-with-docker)
- [Deployment](#-deployment)
- [Future Scope](#-future-scope)

---

## ⚠️ Problem Statement

Healthcare access remains fragmented for millions of people:

- Booking doctor appointments requires multiple phone calls and manual coordination.
- Prescriptions are paper-based and hard to track or digitize.
- There is no convenient way to find pharmacies near you after a late-night consultation.
- Patients have no intelligent assistant to answer general health questions or assess symptoms around the clock.
- Video consultation is either expensive or unavailable in existing hospital management systems.

**MediCare solves all of these problems in one unified platform.**

---

## ✨ Key Features

| Feature                    | Description                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| 🔐 **Authentication**      | JWT-based login/register for Patients, Doctors, and Admins                                     |
| 📅 **Appointment Booking** | Browse doctors by speciality, view available time slots, book and cancel                       |
| 🎥 **Video Consultation**  | Real-time video call between doctor and patient with a built-in meeting room                   |
| 📄 **Prescription OCR**    | Upload a prescription image → Tesseract.js extracts text → fuzzy-matched against a medicine DB |
| 🏥 **Doctor Dashboard**    | Doctors can mark appointments complete, write diagnoses, prescriptions, and notes              |
| 🗺️ **Nearby Pharmacies**   | One-click geolocation → SerpAPI → shows pharmacies sorted by rating                            |
| 🤖 **Aether AI**           | AI healthcare assistant: symptom assessment, appointment queries, health summaries             |
| 💬 **Conversation Memory** | All AI conversations persisted in PostgreSQL and restored on demand                            |
| 👤 **Patient Profile**     | Update personal information, upload profile photo via Cloudinary                               |
| 🛡️ **Admin Panel**         | Manage all doctors and appointments platform-wide                                              |

---

## 🛠️ Technology Stack

### Frontend

| Technology   | Version  | Purpose                                 |
| ------------ | -------- | --------------------------------------- |
| Next.js      | 16.1.6   | Full-stack React framework (App Router) |
| React        | 19.2.3   | UI component library                    |
| TypeScript   | ^5       | Type safety across the entire codebase  |
| TailwindCSS  | ^4       | Utility-first styling                   |
| Lucide React | ^0.563.0 | Icon library                            |

### Backend & Database

| Technology            | Version | Purpose                     |
| --------------------- | ------- | --------------------------- |
| Prisma ORM            | ^5.22.0 | Type-safe database access   |
| PostgreSQL (Supabase) | —       | Primary relational database |
| JWT (jsonwebtoken)    | ^9.0.3  | Authentication tokens       |
| bcryptjs              | ^3.0.3  | Password hashing            |
| Zod                   | ^4.3.6  | Runtime schema validation   |

### AI & External Services

| Technology              | Purpose                                 |
| ----------------------- | --------------------------------------- |
| Google Gemini 2.5 Flash | Core LLM for Aether AI                  |
| Tesseract.js            | Client-side OCR for prescription images |
| string-similarity       | Fuzzy medicine name matching            |
| Cloudinary              | Image storage                           |
| SerpAPI                 | Pharmacy search via Google Maps         |

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Next.js 16 (App Router)             │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────┐ │
│  │  React Pages │  │ Server Actions│  │ API Routes│ │
│  │  (Client)    │  │  (DB Access)  │  │ (REST/AI) │ │
│  └──────┬───────┘  └──────┬────────┘  └─────┬─────┘ │
└─────────┼─────────────────┼────────────────┼─────────┘
          │                 │                │
          ▼                 ▼                ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │   AppContext  │  │  Prisma ORM  │  │  AI Pipeline │
   │  (Global     │  │  (PostgreSQL │  │  (Gemini 2.5 │
   │   State)     │  │   Supabase)  │  │   Flash)     │
   └──────────────┘  └──────────────┘  └──────────────┘
```

### AI Pipeline (Aether AI)

```
User Message
  → Intent Router (keyword detection)
  → Tool Registry (tool lookup)
  → Tool Execution (DB queries / symptom extraction)
  → Context Builder (data cleaning & merging)
  → Prompt Manager (system + intent prompts)
  → Gemini 2.5 Flash (LLM generation)
  → Response Formatter (post-processing)
  → Streaming Response (word-by-word to frontend)
```

---

## 📂 Folder Structure

```
medicare--/
├── prisma/schema.prisma           # Database schema
├── src/
│   ├── app/
│   │   ├── api/chat/              # AI chat REST endpoints
│   │   ├── api/nearby-pharmacies/ # Pharmacy search API
│   │   ├── actions/               # Server Actions (auth, appointments, etc.)
│   │   ├── ai-assistant/          # Aether AI page
│   │   ├── appointment/           # Booking pages
│   │   ├── doctor-dashboard/      # Doctor portal
│   │   ├── admin/                 # Admin panel
│   │   ├── pharmacies/            # Nearby pharmacies page
│   │   └── video-call/            # Video consultation page
│   ├── components/AIAssistant/    # Chat UI components
│   ├── context/AppContext.tsx     # Global React context
│   └── lib/
│       ├── ai/
│       │   ├── AIOrchestrator.ts  # Main AI coordinator
│       │   ├── IntentRouter.ts    # Intent detection
│       │   ├── ToolRegistry.ts    # Tool management
│       │   ├── ResponseFormatter.ts
│       │   ├── classifiers/       # SeverityClassifier
│       │   ├── contextBuilder/    # ContextBuilder
│       │   ├── promptManager/     # PromptManager
│       │   ├── prompts/           # Per-intent prompts (11 files)
│       │   ├── services/          # GeminiService (singleton)
│       │   └── tools/             # AI tools
│       ├── ocrService.ts          # Prescription OCR
│       └── prisma.ts              # Prisma singleton
└── src/middleware.ts              # Route protection
```

---

## ⚙️ Installation

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase recommended)
- Google Gemini API key
- Cloudinary account
- SerpAPI key

### Steps

```bash
# Clone the repository
git clone https://github.com/Ayush-1812/medicare--.git
cd medicare--

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Push Prisma schema to database
npx prisma db push

# Start development server
npm run dev
```

---

## 🔑 Environment Variables

```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."   # non-pooled connection, used for `prisma db push`

# Authentication
JWT_SECRET="your-super-secret-jwt-key"

# AI
GEMINI_API_KEY="your-gemini-api-key"

# Image Storage
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"

# Pharmacy Search
SERPAPI_KEY="your-serpapi-key"

# Seeded admin login
ADMIN_EMAIL="admin@medicare.com"
ADMIN_PASSWORD="your-admin-password"
```

See [`.env.example`](./.env.example) for a ready-to-copy template.

---

## 🚀 Running Locally

```bash
npm run dev     # Start development server (http://localhost:3000)
npm run build   # Production build
npm start       # Start production server
npm run lint    # Run ESLint
```

---

## 🐳 Running with Docker

The app ships with a multi-stage `Dockerfile` and a `docker-compose.yml` that runs the
app alongside its own local PostgreSQL container — no Supabase account needed to try it.

```bash
# 1. Copy the env template and fill in at least JWT_SECRET, GEMINI_API_KEY, ADMIN_PASSWORD
cp .env.example .env

# 2. Build and start both containers
docker compose up --build
```

That's it — on first boot the `app` container automatically runs `prisma db push`
against the bundled Postgres before starting Next.js, so the schema is ready with no
manual step. Visit **http://localhost:3000**.

```bash
docker compose down        # stop the stack
docker compose down -v     # stop and also wipe the local database volume
docker compose logs -f app # tail app logs
```

**Notes:**

- `DATABASE_URL`/`DIRECT_URL` are set inside `docker-compose.yml` to point at the
  bundled `postgres` service — values in your `.env` for those two are ignored by
  Docker Compose on purpose, so pointing this stack at your local Postgres can never
  accidentally touch a real Supabase database.
- `CLOUDINARY_*` and `SERPAPI_KEY` are optional for basic local testing (profile-photo
  upload, prescription upload, and the pharmacy finder simply won't work without them).
- The auto `prisma db push` on boot only runs because `docker-compose.yml` sets
  `RUN_DB_PUSH=true` — it's off by default in the raw `Dockerfile` so pointing the image
  at an external database elsewhere never silently changes its schema.

# <<<<<<< Updated upstream

=======

# 🏥 MediCare — AI-Powered Healthcare Platform

> A full-stack, production-grade healthcare platform that lets patients book appointments with doctors, upload and analyse prescriptions via OCR, video-consult their doctor, find nearby pharmacies, and chat with **Aether AI** — an intelligent medical assistant powered by Google Gemini 2.5 Flash.

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [High-Level Architecture](#-high-level-architecture)
- [Folder Structure](#-folder-structure)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Running Locally](#-running-locally)
- [Running with Docker](#-running-with-docker)
- [Deployment](#-deployment)
- [Future Scope](#-future-scope)

---

## ⚠️ Problem Statement

Healthcare access remains fragmented for millions of people:

- Booking doctor appointments requires multiple phone calls and manual coordination.
- Prescriptions are paper-based and hard to track or digitize.
- There is no convenient way to find pharmacies near you after a late-night consultation.
- Patients have no intelligent assistant to answer general health questions or assess symptoms around the clock.
- Video consultation is either expensive or unavailable in existing hospital management systems.

**MediCare solves all of these problems in one unified platform.**

---

## ✨ Key Features

| Feature                    | Description                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| 🔐 **Authentication**      | JWT-based login/register for Patients, Doctors, and Admins                                     |
| 📅 **Appointment Booking** | Browse doctors by speciality, view available time slots, book and cancel                       |
| 🎥 **Video Consultation**  | Real-time video call between doctor and patient with a built-in meeting room                   |
| 📄 **Prescription OCR**    | Upload a prescription image → Tesseract.js extracts text → fuzzy-matched against a medicine DB |
| 🏥 **Doctor Dashboard**    | Doctors can mark appointments complete, write diagnoses, prescriptions, and notes              |
| 🗺️ **Nearby Pharmacies**   | One-click geolocation → SerpAPI → shows pharmacies sorted by rating                            |
| 🤖 **Aether AI**           | AI healthcare assistant: symptom assessment, appointment queries, health summaries             |
| 💬 **Conversation Memory** | All AI conversations persisted in PostgreSQL and restored on demand                            |
| 👤 **Patient Profile**     | Update personal information, upload profile photo via Cloudinary                               |
| 🛡️ **Admin Panel**         | Manage all doctors and appointments platform-wide                                              |

---

## 🛠️ Technology Stack

### Frontend

| Technology   | Version  | Purpose                                 |
| ------------ | -------- | --------------------------------------- |
| Next.js      | 16.1.6   | Full-stack React framework (App Router) |
| React        | 19.2.3   | UI component library                    |
| TypeScript   | ^5       | Type safety across the entire codebase  |
| TailwindCSS  | ^4       | Utility-first styling                   |
| Lucide React | ^0.563.0 | Icon library                            |

### Backend & Database

| Technology            | Version | Purpose                     |
| --------------------- | ------- | --------------------------- |
| Prisma ORM            | ^5.22.0 | Type-safe database access   |
| PostgreSQL (Supabase) | —       | Primary relational database |
| JWT (jsonwebtoken)    | ^9.0.3  | Authentication tokens       |
| bcryptjs              | ^3.0.3  | Password hashing            |
| Zod                   | ^4.3.6  | Runtime schema validation   |

### AI & External Services

| Technology              | Purpose                                 |
| ----------------------- | --------------------------------------- |
| Google Gemini 2.5 Flash | Core LLM for Aether AI                  |
| Tesseract.js            | Client-side OCR for prescription images |
| string-similarity       | Fuzzy medicine name matching            |
| Cloudinary              | Image storage                           |
| SerpAPI                 | Pharmacy search via Google Maps         |

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Next.js 16 (App Router)             │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────┐ │
│  │  React Pages │  │ Server Actions│  │ API Routes│ │
│  │  (Client)    │  │  (DB Access)  │  │ (REST/AI) │ │
│  └──────┬───────┘  └──────┬────────┘  └─────┬─────┘ │
└─────────┼─────────────────┼────────────────┼─────────┘
          │                 │                │
          ▼                 ▼                ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │   AppContext  │  │  Prisma ORM  │  │  AI Pipeline │
   │  (Global     │  │  (PostgreSQL │  │  (Gemini 2.5 │
   │   State)     │  │   Supabase)  │  │   Flash)     │
   └──────────────┘  └──────────────┘  └──────────────┘
```

### AI Pipeline (Aether AI)

```
User Message
  → Intent Router (keyword detection)
  → Tool Registry (tool lookup)
  → Tool Execution (DB queries / symptom extraction)
  → Context Builder (data cleaning & merging)
  → Prompt Manager (system + intent prompts)
  → Gemini 2.5 Flash (LLM generation)
  → Response Formatter (post-processing)
  → Streaming Response (word-by-word to frontend)
```

---

## 📂 Folder Structure

```
medicare--/
├── prisma/schema.prisma           # Database schema
├── src/
│   ├── app/
│   │   ├── api/chat/              # AI chat REST endpoints
│   │   ├── api/nearby-pharmacies/ # Pharmacy search API
│   │   ├── actions/               # Server Actions (auth, appointments, etc.)
│   │   ├── ai-assistant/          # Aether AI page
│   │   ├── appointment/           # Booking pages
│   │   ├── doctor-dashboard/      # Doctor portal
│   │   ├── admin/                 # Admin panel
│   │   ├── pharmacies/            # Nearby pharmacies page
│   │   └── video-call/            # Video consultation page
│   ├── components/AIAssistant/    # Chat UI components
│   ├── context/AppContext.tsx     # Global React context
│   └── lib/
│       ├── ai/
│       │   ├── AIOrchestrator.ts  # Main AI coordinator
│       │   ├── IntentRouter.ts    # Intent detection
│       │   ├── ToolRegistry.ts    # Tool management
│       │   ├── ResponseFormatter.ts
│       │   ├── classifiers/       # SeverityClassifier
│       │   ├── contextBuilder/    # ContextBuilder
│       │   ├── promptManager/     # PromptManager
│       │   ├── prompts/           # Per-intent prompts (11 files)
│       │   ├── services/          # GeminiService (singleton)
│       │   └── tools/             # AI tools
│       ├── ocrService.ts          # Prescription OCR
│       └── prisma.ts              # Prisma singleton
└── src/middleware.ts              # Route protection
```

---

## ⚙️ Installation

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase recommended)
- Google Gemini API key
- Cloudinary account
- SerpAPI key

### Steps

```bash
# Clone the repository
git clone https://github.com/Ayush-1812/medicare--.git
cd medicare--

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Push Prisma schema to database
npx prisma db push

# Start development server
npm run dev
```

---

## 🔑 Environment Variables

```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."   # non-pooled connection, used for `prisma db push`

# Authentication
JWT_SECRET="your-super-secret-jwt-key"

# AI
GEMINI_API_KEY="your-gemini-api-key"

# Image Storage
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"

# Pharmacy Search
SERPAPI_KEY="your-serpapi-key"

# Seeded admin login
ADMIN_EMAIL="admin@medicare.com"
ADMIN_PASSWORD="your-admin-password"
```

See [`.env.example`](./.env.example) for a ready-to-copy template.

---

## 🚀 Running Locally

```bash
npm run dev     # Start development server (http://localhost:3000)
npm run build   # Production build
npm start       # Start production server
npm run lint    # Run ESLint
```

---

## 🐳 Running with Docker

The app ships with a multi-stage `Dockerfile` and a `docker-compose.yml` that runs the
app alongside its own local PostgreSQL container — no Supabase account needed to try it.

```bash
# 1. Copy the env template and fill in at least JWT_SECRET, GEMINI_API_KEY, ADMIN_PASSWORD
cp .env.example .env

# 2. Build and start both containers
docker compose up --build
```

That's it — on first boot the `app` container automatically runs `prisma db push`
against the bundled Postgres before starting Next.js, so the schema is ready with no
manual step. Visit **http://localhost:3000**.

```bash
docker compose down        # stop the stack
docker compose down -v     # stop and also wipe the local database volume
docker compose logs -f app # tail app logs
```

**Notes:**

- `DATABASE_URL`/`DIRECT_URL` are set inside `docker-compose.yml` to point at the
  bundled `postgres` service — values in your `.env` for those two are ignored by
  Docker Compose on purpose, so pointing this stack at your local Postgres can never
  accidentally touch a real Supabase database.
- `CLOUDINARY_*` and `SERPAPI_KEY` are optional for basic local testing (profile-photo
  upload, prescription upload, and the pharmacy finder simply won't work without them).
- The auto `prisma db push` on boot only runs because `docker-compose.yml` sets
  `RUN_DB_PUSH=true` — it's off by default in the raw `Dockerfile` so pointing the image
  at an external database elsewhere never silently changes its schema.

> > > > > > > Stashed changes

---

## ☁️ Deployment

Deployed on **Vercel** with **Supabase** as the hosted PostgreSQL database.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

The `postinstall` script (`prisma generate`) runs automatically during Vercel deployment.

---

## 🔮 Future Scope

- [ ] Prescription Intelligence — AI drug interaction analysis
- [ ] Health Timeline AI — Automated health narrative from visit history
- [ ] Redis Caching — Reduce AI context build latency
- [ ] Dark Mode — Full dark theme support
- [ ] Push Notifications — Appointment reminders
- [x] Docker Containerization — `docker-compose` for reproducible environments
- [ ] Medical Reports AI — LLM analysis of lab reports

---

## 👤 Author

**Ayush Jangid** — B.Tech CSE (AI) Student

---

> 📘 For the complete technical deep-dive, see [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)

# <<<<<<< Updated upstream

> > > > > > > fb28285 (docker integration)
> > > > > > > Stashed changes
