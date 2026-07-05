# 🏥 MediCare – AI-Powered Healthcare Management Platform

> An AI-first healthcare platform that combines appointment management, intelligent medical assistance, and personalized health insights through a modular AI architecture.

🌐 **Live Demo:** https://medi-care-2vbm.vercel.app/

---

## ✨ Core Features

- 🤖 **Aether AI Assistant** powered by Google Gemini 2.5 Flash
- 📅 Smart Appointment Management
- 🩺 AI-based Symptom Assessment
- ⚠️ Emergency Severity Detection
- 💬 Real-time Streaming AI Responses
- 🧠 Conversation Memory
- 🔐 JWT Authentication & Protected Routes
- 📱 Fully Responsive Interface

---

# 🏗️ AI Architecture

```text
                         User
                           │
                           ▼
                  Next.js Frontend
                           │
                           ▼
                    API Route Layer
                           │
                           ▼
                  Authentication Layer
                           │
                           ▼
                    AI Orchestrator
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
  Intent Router      Tool Registry      Conversation Memory
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
 Appointment Tool   Symptom Tool     (Future AI Tools)
        │                  │
        ▼                  ▼
Appointment      Severity Classifier
Context Service         │
        └───────────────┬───────────────┐
                        ▼
                 Context Builder
                        │
                        ▼
                 Prompt Manager
                        │
                        ▼
            Google Gemini 2.5 Flash
                        │
                        ▼
              Response Formatter
                        │
                        ▼
              Streaming Response
                        │
                        ▼
                   Frontend UI
```

---

# 🧠 AI Request Flow

```text
User Query
    │
    ▼
Authentication
    │
    ▼
Intent Detection
    │
    ▼
Relevant AI Tool
    │
    ▼
Context Extraction
    │
    ▼
Context Builder
    │
    ▼
Prompt Manager
    │
    ▼
Gemini 2.5 Flash
    │
    ▼
Formatted Response
    │
    ▼
Streaming to UI
```

---

# 🛠️ Tech Stack

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend
- Next.js API Routes
- Prisma ORM
- PostgreSQL (Supabase)
- JWT Authentication

### AI Stack
- Google Gemini 2.5 Flash
- AI Orchestrator
- Intent Router
- Tool Registry
- Context Builder
- Prompt Manager
- Response Formatter

### Deployment
- Vercel
- Supabase

---

# 🚀 Getting Started

```bash
git clone <repository-url>
cd medicare

npm install

npx prisma generate
npx prisma db push

npm run dev
```

Create a `.env` file:

```env
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
GEMINI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

# 📂 Current AI Modules

| Module | Status |
|---------|--------|
| Authentication | ✅ |
| AI Orchestrator | ✅ |
| Intent Router | ✅ |
| Tool Registry | ✅ |
| Context Builder | ✅ |
| Prompt Manager | ✅ |
| Gemini Integration | ✅ |
| Appointment Intelligence | ✅ |
| Symptom Assessment | ✅ |
| Severity Classifier | ✅ |
| Conversation Memory | ✅ |
| Streaming Responses | ✅ |

---

# 🚧 Roadmap

- ✅ Appointment Intelligence
- ✅ Symptom Assessment
- 🔄 Prescription Intelligence
- 🔄 Medical Report Intelligence
- 🔄 Health Summary
- 🔄 Timeline Intelligence
- 🔄 Multi-tool AI Reasoning
- 🔄 Dark Mode
- 🔄 Docker Support

---

## 👨‍💻 Author

**Ayush Jangid**

If you found this project helpful, consider giving it a ⭐ on GitHub!
