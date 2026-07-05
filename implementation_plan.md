# AI Assistant Architecture Design

This document outlines the architectural plan for integrating a localized AI Health Assistant into the MediCare V2 project. The assistant will utilize the user's existing medical data (Appointments, Prescriptions, Profile) to provide personalized, context-aware answers.

## User Review Required

> [!IMPORTANT]
> **RAG Approach**: Because an individual user's medical history (prescriptions, appointment notes, profile data) is relatively small and easily fits within modern LLM context windows (e.g., 128k+ tokens), this architecture proposes an **In-Context Injection** model rather than a traditional Vector Database RAG approach. This ensures 100% perfect recall of the user's records without the complexity and potential retrieval loss of vector embeddings. If the dataset scales significantly in the future, Supabase's `pgvector` can be enabled seamlessly.
> 
> **LLM Provider**: This plan assumes the use of a standard LLM provider (e.g., OpenAI, Anthropic, or Gemini) integrated via the Vercel AI SDK. Please confirm your preferred provider or if we should use an existing API key.

---

## 1. Folder Structure

The AI Assistant will introduce the following files into the existing Next.js architecture:

```text
src/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts         # Edge/Serverless Route Handler for streaming LLM responses
│   └── actions/
│       └── aiActions.ts         # Internal actions to fetch and format user medical context
├── components/
│   └── AIAssistant/
│       ├── ChatWidget.tsx       # Floating or embedded chat interface UI
│       ├── ChatMessage.tsx      # Individual message bubble component
│       └── TypingIndicator.tsx  # Animated loading state
```

---

## 2. API Architecture

- **Protocol**: HTTP POST to `/api/chat`.
- **Streaming**: Implemented using Server-Sent Events (SSE) via the Vercel AI SDK (`ai` package) to provide a typing effect and reduce perceived latency.
- **Payload**: Standard OpenAI-compatible format `{ messages: [{ role: 'user', content: '...' }] }`.
- **Authentication**: The route handler will extract the JWT token from cookies, verify it using `jsonwebtoken` and `JWT_SECRET`, and reject unauthorized requests.

---

## 3. Database Interaction Plan

The AI Assistant requires read-only access to the user's data. It will utilize the existing Prisma setup.

1. **User Profile**: `prisma.user.findUnique` to get age, gender, blood group, and basic details.
2. **Appointments**: `prisma.appointment.findMany` filtering by `userId` to retrieve `diagnosis`, `prescription`, `notes`, and doctor details (`docData`).
3. **Prescriptions**: `prisma.prescription.findMany` filtering by `userId` to retrieve `medicines` and `extractedData` (OCR results).

---

## 4. RAG Architecture (In-Context Pattern)

Instead of chunking and embedding data into a vector store, we use a **Dynamic Context Assembly** approach:

1. **Fetch**: Retrieve all relevant patient data from PostgreSQL.
2. **Format**: Serialize the data into a clean Markdown or JSON string (e.g., "Patient History: ... Past Appointments: ...").
3. **Inject**: Prepend a `SystemMessage` to the conversation array containing the formatted context and strict behavioral instructions.
4. **Generate**: The LLM reads the complete, pristine history and answers the user's specific question based entirely on that context.

---

## 5. Context Retrieval Flow

1. **Client**: User types "When is my next appointment?" in `ChatWidget.tsx` and hits Send.
2. **API Route (`/api/chat`)**: Receives the message history.
3. **Auth**: Validates the JWT cookie to extract `userId`.
4. **Context Building**: Calls `fetchUserMedicalContext(userId)` from `aiActions.ts`.
5. **System Prompt Assembly**:
   ```javascript
   const systemPrompt = `You are the MediCare AI Assistant. 
   Answer the user's questions based ONLY on the following medical data:
   --- 
   ${medicalContextString}
   ---
   Never provide official diagnoses. Advise consulting a doctor for serious issues.`;
   ```
6. **LLM Invocation**: The `messages` array is modified to inject the system prompt at index 0.
7. **Streaming Response**: The LLM's response streams back to the client.

---

## 6. Security Considerations

- **Data Isolation (Tenant Separation)**: Context retrieval is strictly bound to `where: { userId: decoded.id }`. Under no circumstances can the LLM access another user's data.
- **Prompt Injection Defense**: The system prompt strictly limits the AI's persona.
- **Medical Liability**: The AI is explicitly instructed to append disclaimers for medical advice and defer to actual doctors.
- **API Key Security**: The LLM provider API key will reside exclusively server-side in `.env` and will never be exposed to the client.

---

## 7. Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant ChatWidget (Client)
    participant /api/chat (Server)
    participant Prisma DB
    participant LLM Provider

    User->>ChatWidget (Client): "What medicines am I taking?"
    ChatWidget (Client)->>/api/chat (Server): POST { messages } + JWT Cookie
    /api/chat (Server)->>/api/chat (Server): Verify JWT -> userId
    /api/chat (Server)->>Prisma DB: Fetch User, Appointments, Prescriptions
    Prisma DB-->>/api/chat (Server): Return Medical Data
    /api/chat (Server)->>/api/chat (Server): Format Context & Assemble System Prompt
    /api/chat (Server)->>LLM Provider: Send Prompt + Context + Messages
    LLM Provider-->>/api/chat (Server): Stream Response Chunks
    /api/chat (Server)-->>ChatWidget (Client): Stream Response (SSE)
    ChatWidget (Client)-->>User: Render Typing Effect
```

---

## 8. Step-by-Step Implementation Plan

- **Step 1: Infrastructure Setup**
  - Install necessary packages: `@ai-sdk/react`, `ai`, and the specific provider SDK (e.g., `@ai-sdk/openai` or `@google/generative-ai`).
- **Step 2: Backend Context Service**
  - Create `src/app/actions/aiActions.ts`.
  - Implement the `fetchUserMedicalContext(userId)` function that securely pulls and formats data from Prisma.
- **Step 3: API Route Implementation**
  - Create `src/app/api/chat/route.ts`.
  - Implement JWT validation, integrate the context service, and setup the streaming response handler using Vercel AI SDK.
- **Step 4: Frontend UI Components**
  - Build `ChatWidget.tsx` using `useChat` hook from `@ai-sdk/react`.
  - Implement modern glassmorphism styling to match the recent UI updates.
- **Step 5: Integration & Testing**
  - Mount the `ChatWidget` on the `Patient Profile` and `Dashboard` pages.
  - Test data isolation and ensure the assistant accurately recalls data from OCR prescriptions and past appointments.
