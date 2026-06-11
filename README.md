# DentaGreet — AI Dental Reception System

> **Investor-demo prototype.** An AI-powered reception system for dental clinics. A patient enters their name, joins a video call with a lifelike AI receptionist (Mia, powered by Tavus CVI), gives or denies consent, answers intake questions, and ends the session. Everything is recorded, transcribed live, and structured intake data is displayed in real time.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend/Backend | Next.js 16 (App Router, TypeScript, Tailwind CSS) |
| AI Video Agent | [Tavus CVI](https://docs.tavus.io) — Conversational Video Interface |
| WebRTC Call Client | `@daily-co/daily-js` (call object mode, custom UI) |
| Database | Supabase (Postgres + Storage) |
| Recording | Client-side canvas composite → MediaRecorder → Supabase Storage |

---

## Prerequisites

- Node.js 18+
- A [Tavus](https://tavus.io) account with API access
- A [Supabase](https://supabase.com) project
- A Tavus replica ID (choose a stock replica from the Tavus library)

---

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd dentagreet
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

```env
TAVUS_API_KEY=                    # From Tavus dashboard → API Keys
TAVUS_REPLICA_ID=                 # Stock replica ID from Tavus library
TAVUS_PERSONA_ID=                 # Output of step 4 below
NEXT_PUBLIC_SUPABASE_URL=         # From Supabase project → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # From Supabase project → Settings → API
SUPABASE_SERVICE_ROLE_KEY=        # From Supabase project → Settings → API (SERVER ONLY)
ADMIN_PASSWORD=                   # Any password for the /admin route
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ **Security:** `SUPABASE_SERVICE_ROLE_KEY` and `TAVUS_API_KEY` are **never** sent to the browser. They are only used in Next.js Route Handlers (`app/api/`). Verify with `npm run build` — no secrets appear in the client bundle.

### 3. Supabase Database Setup

1. Go to your Supabase project → **SQL Editor**
2. Run the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
3. Go to **Storage** → **New bucket**
   - Name: `recordings`
   - Public: **OFF** (private)

### 4. Create the Tavus Persona (one-time)

```bash
npx ts-node --project tsconfig.scripts.json scripts/create-persona.ts
```

This creates "Mia — Dental Reception Assistant" with the correct system prompt and tool definitions. Copy the printed `TAVUS_PERSONA_ID=...` line into your `.env.local`.

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Demo Script (Investor Walkthrough)

Follow this script for a live demo:

### Step 1 — Patient Entry (`/`)
1. Open [http://localhost:3000](http://localhost:3000)
2. Enter a patient name (e.g. "Jane Smith")
3. Click **Join Reception**
4. *Behind the scenes:* server creates a Tavus conversation and a Supabase session row

### Step 2 — Hair Check
1. Browser requests camera + microphone permission — click **Allow**
2. See your camera preview and mic level indicator
3. Click **Start Reception**

### Step 3 — The Call (main demo)
1. Mia (the AI receptionist) appears and greets Jane by name
2. Mia explains the recording/data-use policy and asks for consent
3. **Consent granted path:** Say "Yes" — the consent badge in the right panel turns green ✓
4. Mia asks 5 intake questions one at a time:
   - Reason for visit → panel updates with highlight animation
   - Symptoms → panel updates
   - Duration → panel updates
   - Pain level (0–10) → panel updates
   - Additional notes → panel updates
5. Live transcript scrolls at the bottom showing both speakers
6. Red **● REC** indicator is visible throughout
7. Mia summarizes and says goodbye → session ends automatically

### Step 4 — End Screen
- "Thank you, Jane! The dental team will review your information before your visit."
- Recording uploads to Supabase Storage

### Step 5 — Admin Review (`/admin`)
1. Open [http://localhost:3000/admin](http://localhost:3000/admin)
2. Enter the `ADMIN_PASSWORD` from `.env.local`
3. See Jane's session in the table with status, consent, reason, duration
4. Click the row → full detail page:
   - Complete intake summary
   - Full chat-style transcript
   - **Playable video** of the session (both video + audio)

### Consent Denied Path (optional demo)
- At the consent question, say "No" or "I don't consent"
- Mia thanks Jane and advises contacting the dental team directly
- Session ends with `status=declined`, no intake fields captured
- Admin shows the declined session

---

## Admin Access

Navigate to `/admin`. Enter the `ADMIN_PASSWORD` from your `.env.local`.

> ⚠️ **Prototype-grade auth only.** The admin gate uses a simple password cookie. See Production Roadmap below for real auth.

---

## Architecture Notes

### Security Model
- `TAVUS_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are **server-only** — used exclusively in `app/api/` Route Handlers
- Client only receives `NEXT_PUBLIC_*` variables (Supabase URL + anon key)
- Supabase RLS is enabled on `sessions` with no public policies — all access via service-role key

### Event Flow
1. Patient joins Daily.co room via `conversation_url` from Tavus
2. Tavus broadcasts `app-message` events (utterances, tool calls)
3. All event type constants live in [`lib/tavus-events.ts`](lib/tavus-events.ts) — update here if Tavus changes their API
4. Tool calls update the live intake panel and are persisted via debounced `PATCH /api/sessions/[id]`
5. App works fully without the Tavus webhook (client events are source of truth)

### Recording
- Hidden `<canvas>` composites replica video (75%) + patient PiP + timestamp at 24fps
- `AudioContext` mixes both audio tracks
- `MediaRecorder` produces `video/webm` blob
- On session end: blob uploaded to Supabase Storage `recordings/{sessionId}.webm`
- Admin playback uses short-lived signed URLs (1 hour) generated server-side

### Tavus Persona
- Created once via `scripts/create-persona.ts`
- System prompt enforces the exact flow: greeting → consent → 5 intake questions → closing
- Three tools: `record_consent`, `record_intake_field`, `end_session`

---

## Project Structure

```
app/
  page.tsx                    # / — Patient entry
  meeting/[sessionId]/        # /meeting/[id] — Call screen
  admin/                      # /admin — Admin gate + sessions table
  admin/sessions/[id]/        # /admin/sessions/[id] — Detail + replay
  api/sessions/               # POST (create), GET/PATCH (update)
  api/sessions/[id]/end/      # POST — end Tavus conversation
  api/sessions/[id]/recording/ # POST — upload webm blob
  api/admin/                  # Login, logout, sessions list, detail, signed URL
  api/tavus/webhook/          # POST — Tavus callbacks
components/meeting/
  HairCheck.tsx               # Pre-join camera/mic preview
  CallView.tsx                # Main call orchestrator
  IntakePanel.tsx             # Right 25% live data panel
  TranscriptStrip.tsx         # Rolling transcript
  CallControls.tsx            # Mute + End buttons
hooks/
  useCallState.ts             # Daily call object lifecycle
  useTranscript.ts            # Transcript buffer
  useIntakePanel.ts           # Intake field state + highlight
  useRecording.ts             # MediaRecorder lifecycle
lib/
  tavus-events.ts             # ← ALL Tavus event constants (update here if API changes)
  recording.ts                # Canvas composite + MediaRecorder
  supabase-server.ts          # Server-side Supabase client (service role)
  supabase-browser.ts         # Browser Supabase client (anon key)
  database.types.ts           # TypeScript types for DB schema
  utils.ts                    # Shared helpers
scripts/
  create-persona.ts           # One-time Tavus persona creation
supabase/migrations/
  0001_init.sql               # DB schema
```

---

## Production Roadmap

*The following are intentionally out of scope for this prototype but are the natural next steps for a production system — relevant for investor conversations:*

| Area | What's Needed |
|------|--------------|
| **HIPAA Compliance** | Business Associate Agreements (BAA) with Supabase, Tavus, and Daily.co; encryption at rest; audit logging; access controls |
| **Authentication** | Real patient accounts (NextAuth / Clerk / Auth0); staff/admin roles; MFA |
| **EHR Integration** | HL7 FHIR API integration to push intake data directly into practice management systems (Dentrix, Eaglesoft, Open Dental) |
| **Appointment Scheduling** | Calendar integration; SMS/email confirmations and reminders |
| **Mobile Support** | Responsive layouts for tablet/phone; native app wrappers |
| **Multi-language** | Tavus supports multiple languages; UI i18n via next-intl |
| **Patient Portal** | Returning patient accounts; history; pre-filled forms |
| **Payment Processing** | Co-pay collection; insurance verification |
| **Analytics Dashboard** | Session metrics; completion rates; common chief complaints |
| **Scalability** | Edge deployment; CDN for recordings; database connection pooling |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Tavus API error" on join | Check `TAVUS_API_KEY`, `TAVUS_REPLICA_ID`, `TAVUS_PERSONA_ID` in `.env.local` |
| Camera/mic denied | Allow permissions in browser settings; refresh |
| Supabase insert error | Run the SQL migration; check `SUPABASE_SERVICE_ROLE_KEY` |
| No recording in admin | Recording uploads after session ends — wait for "Uploading session…" to complete |
| Mia doesn't greet by name | Check `TAVUS_PERSONA_ID` — re-run `scripts/create-persona.ts` if needed |
| Admin login fails | Check `ADMIN_PASSWORD` in `.env.local` |
| Build error | Run `npx tsc --noEmit` to see TypeScript errors |

---

*DentaGreet prototype — not for clinical use. Built with Tavus CVI, Daily.co, and Supabase.*
