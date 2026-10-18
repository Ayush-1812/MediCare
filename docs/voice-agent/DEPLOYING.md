# Deploying MediCare (with voice and video working)

## Why not Vercel

Vercel **does not run custom servers**. `server.js` — which wraps Next and hosts the
Socket.IO server — is never executed there. Two features live entirely on that server:

- **Voice receptionist** — the gateway and the audio channel
- **Video consultations** — WebRTC SDP/ICE signalling

On Vercel both are absent. The rest of the app works, which is what makes it confusing:
pages render, logins work, bookings save, and then the voice panel reports that it cannot
reach the service while video calls never connect.

Vercel's WebSocket support (public beta) runs inside a Vercel Function and inherits its
duration limit, so it does not solve a 10–30 minute voice session either.

**Any host that runs `node server.js` works.** The steps below use Render because it reads
the `render.yaml` in this repository, builds the existing Dockerfile and supports
WebSockets on the free plan. Railway, Fly.io, a VPS or any container host are equally
valid — only the dashboard differs.

---

## Before you start

Have these to hand (they are already in your local `.env`):

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Supabase → Connect → pooled connection, port **6543**, `?pgbouncer=true` |
| `DIRECT_URL` | Same page, direct connection, port **5432** |
| `JWT_SECRET` | **Must be the same value you use now** — change it and every existing session is logged out |
| `GEMINI_API_KEY` | Google AI Studio. Without it the app still boots; voice disables itself with a warning |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Your admin credentials |

Optional, each degrading safely if absent: `SERPAPI_KEY` (pharmacy search), the three
`CLOUDINARY_*` values (image uploads), the `SMTP_*` values (confirmation emails), and the
three `TURN_*` values (video calls across restrictive networks).

---

## Steps

### 1. Push the branch

```bash
git push origin voice-agent
```

Merge it into `main` first if you want `main` deployed.

### 2. Create the service

1. Sign in at **dashboard.render.com**
2. **New → Blueprint**
3. Connect the GitHub repo `Ayush-1812/MediCare`
4. Pick the branch (`voice-agent`, or `main` after merging)
5. Render reads `render.yaml` and proposes one web service called **medicare**
6. **Apply**

### 3. Fill in the environment variables

Render prompts for every value marked `sync: false`. Paste them from your `.env`.

**Leave these alone:**
- `PORT` — Render sets it; the server reads it
- `VOICE_INTERNAL_SECRET` — generated per boot inside the process
- `RUN_DB_PUSH` — must stay unset, or a deploy could alter your live schema

Set `APP_URL` to a placeholder for now; you get the real URL in the next step.

### 4. Wait for the first build

Eight to twelve minutes — it installs dependencies twice (build and production) and runs
`next build`. Watch the log for:

```
[voice] receptionist gateway listening on /voice
▲ MediCare ready on http://0.0.0.0:10000
[signaling] Socket.IO listening on /api/socket
```

**All three lines must appear.** If the voice line is missing and instead says
`GEMINI_API_KEY is not set`, that variable did not save.

### 5. Set `APP_URL` properly

Render shows your URL, e.g. `https://medicare-xxxx.onrender.com`. Put it in `APP_URL` and
save — the service restarts. This is what appointment emails use for "join video call"
links, so a wrong value sends patients to localhost.

### 6. Verify

Open the URL and check, in order:

1. **Landing page loads** — the app is up
2. **Sign in as a patient** — database and JWT are correct
3. **Mic button appears bottom-right** — you are authenticated as a patient
4. **Click it, then Start talking** — allow the microphone
5. **Status reads "Listening"**, and the dot reacts when you speak

Then say *"what appointments do I have?"* and let it answer on its own.

Also test a **video consultation**, since it uses the same socket server and was equally
broken on Vercel.

---

## If something fails

| Symptom | Cause | Fix |
|---|---|---|
| "The voice service could not be reached" | The socket never connected | Open the browser console — the real transport reason is logged there verbatim |
| Voice line missing from the deploy log | `GEMINI_API_KEY` not set | Add it in Render → Environment |
| Everyone logged out after deploying | `JWT_SECRET` differs from before | Set it to the original value |
| Container restart loop | Healthcheck probing the wrong port | Fixed — the healthcheck reads `$PORT`. Confirm you deployed a commit including that fix |
| Microphone never prompts | Not a secure context | Render serves HTTPS, so this should not occur; on a custom domain make sure TLS is active |
| First request after idle takes ~50s | Render free plan spins down after 15 minutes | Expected. Paid plans stay warm |

---

## Notes

- **No database migration is needed.** `rescheduleAppointment` writes existing columns.
- **One instance is the supported configuration.** Scaling past one replica needs
  `REDIS_URL` for signalling rooms; read the deployment notes in `SETUP.md` first, because
  voice sessions keep per-process state.
- **The free plan sleeps after 15 minutes of inactivity.** Fine for a demo; a cold start
  takes roughly a minute and the first voice session after one will feel slow.
- **Your Gemini key is on the free tier.** The Live API allows only a few concurrent
  sessions there, so several people using voice at once will queue.
