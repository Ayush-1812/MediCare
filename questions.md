# 🎯 Interview Questions — MediCare Resume Points

> Based on your 3 resume bullet points. These are the exact questions interviewers ask when they read these lines.

---

## Resume Line 1
> *"Architected a full-stack telemedicine platform with JWT authentication and role-based access control across 3 roles (patient, doctor, admin) covering appointment booking, prescriptions, and consultation history."*

---

### Q1. What is JWT? How does it work?

**Answer:**

JWT stands for **JSON Web Token**. It's a way to prove who you are without the server needing to remember you (stateless).

Think of it like a **stamp on your hand at a concert**. Once you have the stamp, the bouncer doesn't need to check the guest list every time — he just checks the stamp.

**How it works in our app:**
1. You log in with email + password
2. Server checks the password → if correct, it creates a JWT that looks like this:
   ```
   eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMyIsInJvbGUiOiJ1c2VyIn0.SIGNATURE
   ```
   (Three parts separated by dots: Header . Payload . Signature)
3. The payload contains `{ id: "123", role: "user" }`
4. It's signed with a secret key (JWT_SECRET) so no one can fake it
5. Stored in an **httpOnly cookie** on the browser
6. Every request the browser makes, this cookie is sent automatically
7. Server reads the cookie, verifies the signature, knows who you are

---

### Q2. What is Role-Based Access Control (RBAC)? How did you implement it?

**Answer:**

RBAC means different users get different permissions based on their role.

In our app:
- **Patient** → can book appointments, view their own history, chat with AI
- **Doctor** → can see their appointments, write prescriptions, start video calls
- **Admin** → can add/remove doctors, see all appointments, toggle availability

**How we implemented it:**

We have **3 separate JWT cookies**:
- `token` for patients
- `docToken` for doctors
- `adminToken` for admins

Each JWT contains a `role` field. When a doctor tries to access a patient route, the server checks the role claim and rejects it — even if the JWT signature is valid.

**Two layers of protection:**
1. **Middleware** — fast Edge check, redirects wrong role to login page
2. **Server Actions** — real verification, checks signature + role before touching data

---

### Q3. Why use httpOnly cookies instead of localStorage for JWT?

**Answer:**

**localStorage** is readable by JavaScript — so if your site has an XSS (Cross-Site Scripting) vulnerability, an attacker's injected script can steal the token and impersonate the user.

**httpOnly cookie** cannot be read by JavaScript at all — only the browser sends it automatically with each request. Even if someone injects a script, they can't steal the token.

Simple analogy: localStorage is like putting your house key on a table in public. httpOnly cookie is like the key being built into the door — only the lock uses it, no one can grab it.

---

### Q4. What is bcrypt? Why use it for password storage?

**Answer:**

bcrypt is a **hashing algorithm** specifically designed for passwords. Unlike MD5 or SHA256, bcrypt is intentionally **slow**.

Why slow is good here:
- Hashing a password takes ~100ms with bcrypt
- If a hacker steals the database and tries 1 billion passwords, at 100ms each it takes 3+ years
- With MD5 (milliseconds per hash), they can crack it in hours

We never store the actual password. We store the hash. When you log in, we run bcrypt on your input and compare the hashes.

---

### Q5. How does appointment booking work end to end?

**Answer:**

1. Patient opens a doctor's profile → sees available slots
2. Slots are calculated from `slotStartTime`, `slotEndTime`, `slotDuration` (from the Doctor record in the DB)
3. Already-booked slots are filtered out by checking the `slots_booked` JSON field
4. Patient clicks a slot → a Server Action runs on the server:
   - Verifies the patient's JWT cookie
   - Checks the slot is still available (prevents race conditions)
   - Creates an `Appointment` row in PostgreSQL
   - Updates `slots_booked` on the Doctor record
   - Sends a confirmation email
5. Patient sees updated appointment list

---

### Q6. You mentioned 3 roles. How does the admin panel work? Is there an admin in the database?

**Answer:**

No, there's **no admin account in the database**. Admin credentials are stored in environment variables:
```
ADMIN_EMAIL=admin@medicare.com
ADMIN_PASSWORD_HASH=<bcrypt hash>
```

Why? If admin credentials were in the database, a SQL injection attack could expose them. Environment variables are outside the database entirely.

When the admin logs in, we compare the submitted email and password against these env vars using **timing-safe comparison** (to prevent timing attacks where response time reveals how much of a guess was correct).

---

### Q7. What is a "timing attack" and how do you prevent it?

**Answer:**

A timing attack is when an attacker measures how long a comparison takes to figure out the answer.

Example: If `"a" !== "password123"` returns instantly (fails at first character), but `"passw" !== "password123"` takes slightly longer (fails at 5th character), the attacker can guess character by character.

**Fix:** Use `crypto.timingSafeEqual()` which always takes the same amount of time regardless of how many characters match. We hash both strings first (so they're the same length, which `timingSafeEqual` requires), then compare.

---

### Q8. What is a prescription? How does the prescription feature work?

**Answer:**

A prescription is a doctor's written instruction for medicines — which drug, what dose, how often, for how long.

In our app, patients can **upload a photo** of a handwritten prescription:

1. Patient takes a photo in the browser
2. **Tesseract.js** (OCR library running in the browser) reads the text from the image
3. Our parser analyzes the text:
   - Finds medicine names (by looking for patterns like "Tab.", "500mg", "OD", "BD")
   - Fixes OCR typos using fuzzy matching (e.g., "Amoxicilln" → "Amoxicillin")
4. Patient reviews, corrects if needed, then saves
5. Image goes to Cloudinary; data goes to PostgreSQL

For consultations: the doctor writes the prescription directly in the text field during the video call.

---

### Q9. How do you handle the consultation history feature?

**Answer:**

Every `Appointment` in the database has fields for the full consultation outcome:
- `diagnosis` — what the doctor found
- `prescription` — medicines prescribed
- `notes` — doctor's private notes (never shown to the patient)
- `patientNotes` — patient's own notes (never shown to the doctor)
- `startTime`, `endTime`, `duration` — call timing
- `followUpDate` — when to come back

After a consultation ends, the patient can view a summary page showing diagnosis, prescription, and their own notes.

**Important:** The server strips doctor's notes from the patient's response and patient's notes from the doctor's response. Even if someone inspects the network traffic, they only see what they're allowed to see.

---

### Q10. What is the difference between "cancelled", "isCompleted", and "payment" fields on Appointment?

**Answer:**

- `cancelled` — patient or doctor cancelled this appointment. It won't happen.
- `isCompleted` — the video consultation has finished and the doctor submitted the report.
- `payment` — the patient paid online via Razorpay.

An appointment can be `payment: true` but `isCompleted: false` (paid but not yet consulted).
An appointment can be `isCompleted: true` but `payment: false` (consultation done, patient will pay at clinic).

---

## Resume Line 2
> *"Engineered peer-to-peer video consultations with WebRTC and a custom Node.js + Socket.IO signaling server for SDP/ICE negotiation, using Redis pub/sub to synchronize sessions across multiple server instances."*

---

### Q11. What is WebRTC? Explain it simply.

**Answer:**

WebRTC (Web Real-Time Communication) is a browser technology that lets **two browsers talk directly to each other** — sending video, audio, and data — without going through a server.

Think of it like this: normally when you call someone, your voice goes → phone tower → their phone tower → their phone. WebRTC is like two people shouting directly at each other across the street (peer-to-peer). The server just helps them find each other first.

**Benefits:**
- Very low latency (no middle server for media)
- No video storage on server (privacy)
- Server load is minimal (just the initial handshake)

---

### Q12. What is SDP? What is ICE? Why do you need them?

**Answer:**

**SDP (Session Description Protocol):**
Before two browsers can talk, they need to agree on: what video codec? what audio codec? what resolution? This "capability card" is the SDP.

Think of it like two people agreeing on a language before calling: "I speak English and Hindi" → "I only speak Hindi, let's use Hindi" → call starts.

**ICE (Interactive Connectivity Establishment):**
ICE is the process of finding the best network path between two browsers. A browser might be on a home WiFi (private IP), a phone hotspot, or a corporate network. ICE tries multiple possible connection paths and picks the best one that works.

**STUN:** Helps a browser find its own public IP (since home routers hide it)
**TURN:** A relay server used when no direct path works (firewalls, strict corporate networks)

---

### Q13. What is "signaling" and why does it need a server?

**Answer:**

Signaling is the **introduction process** before the WebRTC call starts. The two browsers need to exchange their SDPs and ICE candidates with each other — but they can't do that directly because they haven't connected yet (chicken-and-egg problem).

So they use a **signaling server** as a middleman — just to pass these small messages back and forth. Once the call is established, the signaling server is no longer needed.

In our app, **Socket.IO** (real-time WebSocket library) handles this signaling. The custom `server.js` file wraps Next.js and adds Socket.IO on the same HTTP port (3000).

---

### Q14. What is Socket.IO? Why use it instead of plain WebSockets?

**Answer:**

**Plain WebSockets** are a browser standard for bidirectional real-time communication. They're great but they:
- Don't reconnect automatically if the connection drops
- Don't have built-in "rooms" (groups)
- Don't fall back to HTTP polling if WebSockets are blocked

**Socket.IO** builds on WebSockets and adds:
- **Automatic reconnection** — if connection drops, it retries
- **Rooms** — group sockets together (e.g., all people in appointment "abc123" are in room "abc123")
- **Fallback** — if WebSockets are blocked by a firewall, it falls back to HTTP long-polling
- **Events** — cleaner than raw message strings

For our video calls, rooms are critical — when the doctor sends a signal, we need it to go only to the patient in that specific appointment, not everyone on the server.

---

### Q15. What does your custom Node.js server (`server.js`) do exactly? Why not just use Next.js's built-in server?

**Answer:**

**The problem:** Next.js's `next start` command starts a server internally, but you can't add WebSockets to it because it doesn't expose the underlying HTTP server.

**Our solution:** We create our OWN HTTP server in `server.js`:
```javascript
const server = createServer((req, res) => {
    handle(req, res) // Next.js handles all normal requests
})

const io = new Server(server, { path: '/api/socket' })
// Socket.IO handles WebSocket connections at /api/socket
```

This way:
- Normal browser requests (pages, API calls) → handled by Next.js
- WebSocket connections to `/api/socket` → handled by Socket.IO
- Both run on the **same port (3000)** — no extra ports needed

---

### Q16. How does the actual video call negotiation flow work? Step by step.

**Answer:**

```
1. Doctor opens the video call page
   → Browser asks for camera/mic permission (getUserMedia)
   → Socket.IO connects to signaling server with appointment ID

2. Patient opens the video call page
   → Same steps
   → Server notifies the doctor: "peer-joined"

3. Doctor creates an SDP Offer
   → "I support H264 video, Opus audio, here's my ICE candidates..."
   → Sent to server via Socket.IO

4. Server relays Offer to Patient (pure relay, never inspects content)

5. Patient creates SDP Answer
   → "Great, I support those too, here's MY ICE candidates..."
   → Sent back via Socket.IO

6. Server relays Answer to Doctor

7. Both sides exchange ICE candidates (network paths to try)

8. Browsers try all paths, pick the best one → direct P2P connection!

9. Video/audio now flows directly between browsers
   → Server is now out of the loop for media
```

**Doctor is always the caller** (sends the offer). This is a deliberate design choice to prevent "SDP glare" — the situation where both sides try to call simultaneously and get confused.

---

### Q17. What is Redis pub/sub? Why do you need it for Socket.IO?

**Answer:**

**The problem without Redis:**

Imagine you have 2 server instances behind a load balancer:
- Doctor connects → load balancer sends them to **Server A**
- Patient connects → load balancer sends them to **Server B**
- Doctor sends a signal → Socket.IO on Server A looks for the patient's socket... but it's on Server B!
- Signal is lost. Call never connects.

**Redis pub/sub solves this:**

Redis is a shared message bus. When Server A wants to send a message to a room, it publishes to Redis. Server B is subscribed to Redis, receives the message, and delivers it to the sockets in that room on its side.

```
Server A → publishes "signal" to Redis → Server B reads it → delivers to Patient
```

Now it doesn't matter which server handles which request — they all share information through Redis.

**In simple terms:** Redis makes all your server instances act like one big server.

---

### Q18. What happens if the connection drops mid-call?

**Answer:**

WebRTC handles this with connection states:

1. `disconnected` — connection is unstable, trying to recover automatically
2. Our code sets status to `reconnecting` and shows a banner: "Connection unstable — reconnecting..."
3. WebRTC itself tries to re-establish the connection using existing ICE candidates
4. If it recovers → status goes back to `connected`
5. If it can't recover after all retries → status becomes `failed`
6. Patient sees an error message with the reason
7. They can reload the page to try again

The Socket.IO signaling channel is separate from the media channel — even if media drops, signaling can help renegotiate.

---

### Q19. What is screen sharing and how did you implement it?

**Answer:**

Screen sharing uses `navigator.mediaDevices.getDisplayMedia()` — this is a browser API that asks the user "which screen/window/tab do you want to share?" and returns a video stream of it.

**Implementation:**

When the doctor (or patient) clicks "Share Screen":
1. `getDisplayMedia()` gets a screen video track
2. We find the existing video "sender" in the WebRTC peer connection
3. We call `sender.replaceTrack(screenTrack)` — this swaps the camera feed for the screen feed **without renegotiating the entire connection** (no SDP needed again)
4. The other side automatically sees the screen

When they stop sharing:
1. We call `sender.replaceTrack(cameraTrack)` to swap back to camera
2. We call `.stop()` on the screen track — very important! Without this, the browser's "you are sharing your screen" indicator keeps showing even though you've stopped

---

### Q20. What security checks does the signaling server do before letting someone join a call?

**Answer:**

The Socket.IO server has **middleware** (runs before any socket connects) that:

1. Reads the JWT cookie from the WebSocket handshake headers
2. Verifies the JWT signature AND checks the `role` claim
3. Looks up the appointment in PostgreSQL
4. Checks: is this doctor/patient actually part of THIS appointment?
5. If all checks pass → socket joins the room
6. If any check fails → connection is rejected with a specific error message

This means you can't join someone else's video call just by guessing an appointment ID. You must be either the doctor or patient on that specific appointment.

---

### Q21. What happens if the same person opens the call in two browser tabs?

**Answer:**

The server detects this and handles it gracefully:

When a new socket connects:
1. Server looks for existing sockets in that room with the **same role**
2. If found → these are "stale" connections from the same person
3. Server sends a `replaced` event to the stale socket → it shows an error message: "This consultation was opened in another tab"
4. Stale socket is disconnected
5. The new tab takes over

**Why this matters:** Without this, a stale connection from a previous tab would "fill the slot" for that role, and the real user would get "room full" error even though they're the legitimate participant.

---

## Resume Line 3
> *"Containerized the application with Docker and integrated Razorpay payments and Google Gemini API to power an AI health assistant."*

---

### Q22. What is Docker? Why did you containerize this app?

**Answer:**

Docker is a tool that packages your application + all its dependencies + configuration into a **container** — a lightweight, isolated environment that runs the same way on any machine.

**Why this matters:**

Without Docker: "It works on my machine" — your app needs Node.js 20, PostgreSQL 16, specific env vars, etc. Someone else's machine might have different versions and it breaks.

With Docker: You give them one command — `docker compose up` — and everything starts exactly the same: the app, the database, Redis, all with the right versions.

**Our docker-compose.yml starts 3 services:**
- `app` — the Next.js + Socket.IO application
- `postgres` — PostgreSQL database
- `redis` — Redis for Socket.IO adapter

They're connected in a private network and `app` waits for `postgres` and `redis` to be healthy before starting.

---

### Q23. What is docker-compose? How does it differ from just using Docker?

**Answer:**

**Docker** lets you run a single container.

**Docker Compose** lets you run **multiple containers together** and define how they connect.

In our case, we need 3 things running simultaneously (app, postgres, redis). Without compose, you'd have to run 3 separate commands, manually create a network, and link them. With compose, one `docker compose up` handles all of it.

Our compose file also handles:
- Health checks (wait for postgres to be ready before starting the app)
- Environment variables
- Volume mounting (postgres data persists across restarts)
- Automatic restart (`restart: unless-stopped`)

---

### Q24. How does the Razorpay payment integration work?

**Answer:**

Razorpay has a specific secure flow that prevents payment fraud:

**Step 1 — Server creates an Order:**
```
Patient clicks "Pay" → calls createPaymentOrder() Server Action
Server calls Razorpay API: "Create an order for ₹500"
Razorpay returns: { orderId: "order_xyz", amount: 50000 }  // paise
```

**Step 2 — Client opens Razorpay's checkout:**
```
Browser loads Razorpay's JavaScript (checkout.js)
Opens a secure popup with the order details
Patient enters card/UPI details on Razorpay's own secure page
```

**Step 3 — Razorpay returns proof of payment:**
```
After payment: { orderId, paymentId, signature }
The signature is an HMAC-SHA256 of "orderId|paymentId" signed with our secret
```

**Step 4 — Server verifies (the crucial step):**
```
Server computes its own signature from orderId|paymentId using the same secret
Compares with the signature Razorpay returned
If they match → payment is genuine → mark appointment as paid
If they don't match → reject (someone tried to fake a payment)
```

**Why not just trust the client's "success" callback?**
Because anyone could write `fetch('/api/mark-paid', { appointmentId: 'xyz' })` in the browser console. The HMAC signature is the only thing that can't be faked without Razorpay's secret.

---

### Q25. What is HMAC-SHA256? Explain simply.

**Answer:**

HMAC-SHA256 is a way to create a "fingerprint" of a message that:
1. Is unique to that specific message
2. Can only be created if you know the secret key
3. Cannot be reverse-engineered to find the secret

**Simple analogy:** Imagine a wax seal on a letter. Only the king has the royal seal. When you get a letter with the seal, you know it really came from the king — you can't fake it without the seal.

In our case:
- Razorpay has the "seal" (secret key)
- They create the HMAC from `orderId|paymentId`
- We verify it by computing the same HMAC ourselves (we also have the key)
- If they match, the payment is real

---

### Q26. How does the Google Gemini AI health assistant work?

**Answer:**

The AI assistant (named Aether) uses a pipeline:

**Step 1 — Intent Detection:**
When you type "show me my appointments", the IntentRouter scans for keywords like "appointment", "schedule", "booking" → figures out you're asking about appointments.

**Step 2 — Tool Selection:**
Based on the intent, it picks the right tool. For appointments → `AppointmentTool`.

**Step 3 — Real Data Fetching:**
The `AppointmentTool` queries your actual appointments from PostgreSQL. This is critical — the AI only works with your real data, never makes things up.

**Step 4 — Prompt Building:**
A system prompt (instructions for the AI) + your data as context + conversation history + your message are combined into one big prompt.

**Step 5 — Gemini API Call:**
This prompt is sent to Google's Gemini AI, which generates a natural language response.

**Step 6 — Streaming:**
The response is streamed back word by word, so it feels like the AI is "typing" in real time.

---

### Q27. Why did you choose Google Gemini over OpenAI GPT?

**Answer:**

Good question for an interview. Honest answer: Gemini was chosen because:

1. **Cost** — Gemini's API is competitive/cheaper for the use case
2. **Integration** — `@google/genai` npm package has good TypeScript support
3. **Context window** — Gemini handles long medical context well
4. **Availability** — Works well for Indian developers/deployment (no geo-restrictions)

However, the architecture is model-agnostic — the `GeminiService` class is the only place that knows about Gemini. Swapping to OpenAI would only require changing that one service, not the entire pipeline.

---

### Q28. What if the Gemini API is down or rate-limited? Does the whole app break?

**Answer:**

No. The AI assistant shows an error message, but everything else works fine:

- Appointment booking → no AI involved, works fine
- Video calls → no AI involved, works fine
- Prescription scanning → Tesseract.js (browser OCR) still works; the AI is just an optional enhancement. If Gemini is down, the parser's result is shown instead.

The code explicitly catches AI failures and falls back gracefully:
```
try {
    corrected = await correctPrescriptionText(...)
} catch (error) {
    // AI failed → use parser result instead
    return { ...parsedResult, source: 'parser', warnings: ['AI unavailable'] }
}
```

---

### Q29. What is containerization and why does it matter in production?

**Answer:**

Containerization means packaging your app so it runs identically in:
- Your laptop (development)
- A test server (staging)
- A production cloud server

**Why it matters:**

1. **Consistency** — No more "it works on my machine" issues
2. **Easy deployment** — `docker pull` + `docker compose up` → app is running
3. **Isolation** — If the app crashes, it doesn't affect the host machine or other containers
4. **Scaling** — Want 3 copies of the app? Just say `docker compose up --scale app=3`. Redis adapter handles the WebSocket coordination.
5. **Rollbacks** — Docker images are versioned. If a new version breaks, switch back to the old image.

---

### Q30. What are environment variables and why are they important in Docker?

**Answer:**

Environment variables are configuration values that live **outside the code** — things like passwords, API keys, database URLs.

**Why not hardcode them?**
If you write `const apiKey = "sk-abc123"` in your code and push to GitHub, that key is now public. Anyone can use it. This is a real security incident.

**In Docker:**
Our `docker-compose.yml` passes env vars from a `.env` file to the container:
```yaml
environment:
    JWT_SECRET: ${JWT_SECRET}
    GEMINI_API_KEY: ${GEMINI_API_KEY}
```

The `.env` file is in `.gitignore` — it never goes to GitHub. The Docker container gets the real values at runtime.

This also makes the app flexible — different environments (dev, staging, production) can have different databases, API keys, etc. without changing any code.

---

## Bonus: General Questions They Might Ask

### Q31. What was the hardest technical challenge in this project?

**Answer (suggested):**

The hardest part was the **WebRTC implementation**. WebRTC involves many moving parts:
- Getting camera/mic permissions (can fail transiently)
- Socket.IO signaling (must be secure and role-aware)
- ICE candidate ordering (candidates arrive before the answer, must queue them)
- React's StrictMode (mounts effects twice in dev, tore down the camera)
- Duplicate tab handling (stale sockets filling the room)
- Screen sharing (must stop the capture track explicitly or browser keeps "sharing" indicator)

Each of these caused real bugs that required careful debugging.

---

### Q32. How would you improve this project if you had more time?

**Answer (suggested):**

1. **End-to-end encrypted chat** — Right now data is encrypted in transit (HTTPS) but not at rest
2. **Real AI streaming** — Use Gemini's native streaming instead of splitting words
3. **Global rate limiting** — Move from in-process counters to Redis so all server instances share limits
4. **TURN server** — Some corporate networks block P2P WebRTC; a self-hosted Coturn server would fix this
5. **Push notifications** — Remind patients 30 minutes before their appointment
6. **Lab report upload** — Currently the OCR only handles prescriptions; extending to lab reports would add value
7. **Multi-language support** — The OCR currently handles English; multi-language Tesseract models exist

---

### Q33. How did you test this application?

**Answer (suggested):**

Mostly manual testing with real flows:
- Created test patient and doctor accounts
- Booked appointments and verified slot blocking
- Tested the WebRTC call between two browser windows (one incognito)
- Tested payment flow using Razorpay's test mode (test card numbers)
- Tested prescription OCR with real prescription photos
- Tested the AI assistant with various health queries

For production, I would add:
- Unit tests for the prescription parser (pure function, easy to test)
- Integration tests for Server Actions using a test database
- E2E tests using Playwright (already in devDependencies)

---

*Based on resume points for MediCare — September 2026*
