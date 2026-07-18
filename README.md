# Groq Chat

A self-hosted chat app backed by Groq's API. React frontend, FastAPI
backend acting as a thin proxy so your Groq key never reaches the
browser. Multiple saved conversations, shareable read-only links, and
a light/dark theme inspired by PhonePe's home screen and Upstox's
fintech visual language.

## Why a backend at all?

Groq's API key must stay server-side. If the frontend called Groq
directly, the key would sit in plain view in every browser's network
tab and dev tools — anyone could grab it. The FastAPI backend holds
the key and is the only thing that talks to Groq; the frontend only
ever talks to your own backend.

## Setup

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and paste your real GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
```

**Frontend** (separate terminal — keep both running side by side):
```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Features

**Multiple chats** — sidebar like ChatGPT's. New chat, switch between
saved conversations, rename, delete. Each conversation auto-titles
itself from your first message. All stored in `localStorage`
(`frontend/src/useChatSessions.js`).

**Shareable links** — the Share button freezes the current
conversation as a snapshot on the backend (`backend/data/shares/`,
plain JSON files) and copies a `/share/<id>` link to your clipboard.
Anyone with the link sees a read-only view — no login, no access to
your other chats. Edits to the original conversation after sharing
don't change what the link shows; it's a frozen snapshot, same as
ChatGPT's own share behavior.

**Theme toggle** — light/dark switch in the header (the pill-shaped
"tablet" toggle). Preference is remembered per-browser. Both palettes
live in `frontend/src/theme.css` as CSS variables — that's the one
file to touch to reskin the whole app.

**Quick-start prompts** — the empty state shows a 2×2 grid of
starting points (explain a concept, write code, summarize, translate)
in the same tile pattern PhonePe uses for its home-screen quick
actions, adapted for a chatbot instead of a payments app.

**Latency badge** — every assistant reply shows how long it took
(`▲ 187ms`), styled like a stock-ticker gain indicator. This is the
one place the fintech theme ties directly into what Groq is actually
for: speed.

## Chat history

Stored in the browser's `localStorage`, per-browser, not synced
anywhere. Clearing browser data or using a different browser/device
starts fresh. `frontend/src/useChatSessions.js` is the one file to
swap if this ever needs to become backend-synced — the rest of the
app doesn't know or care where history comes from.

Current model: `llama-3.3-70b-versatile` — change `GROQ_MODEL` in
`.env` to switch (see Groq's docs for current available models).

## Deploying

For a real deployment (not just localhost), you'd host the backend
somewhere (Render, Railway, Fly.io — same pattern as your other
FastAPI projects) with `GROQ_API_KEY` set as an environment variable
there, then build the frontend (`npm run build`) and serve the
`dist/` folder — either from the same FastAPI app via `StaticFiles`
(see your other projects for that pattern) or from a static host like
Vercel/Netlify pointed at the deployed backend's URL via
`CORS_ORIGINS`.

One thing to check if you deploy frontend and backend separately:
your static host needs an SPA fallback rule so `/share/<id>` serves
`index.html` instead of 404ing — Vercel/Netlify both support this
(a rewrite rule sending all paths to `/index.html`).

## Memory (cross-chat)

The assistant remembers durable facts about you across every
conversation, not just the current one — name, preferences, ongoing
projects. Two ways facts get stored:

- **Auto-extraction**: after each exchange, a background call asks
  the model "was anything here worth remembering long-term?" and
  quietly stores what it finds (`backend/app/routers/memory.py`,
  `EXTRACTION_SYSTEM_PROMPT`). This never blocks or interrupts the
  chat — if it fails, nothing breaks.
- **Manual**: the Memory panel (🧠 button in the header) lets you
  view everything stored, edit any fact that's wrong, delete
  anything, or add facts directly.

Stored server-side as plain JSON (`backend/data/memory.json`) since
it needs to persist across every chat session, not just one browser's
`localStorage`. Gitignored — don't commit it, it's personal data.

## Roles

The 🎭 picker in the composer lets you set a system-prompt override
for the *current chat* — "Code reviewer", "Patient teacher",
"Concise expert", "Creative writer", or a custom one you write
yourself. Different chats can have different roles; it's stored per
session, not globally.

## Model note

Groq deprecated `llama-3.3-70b-versatile` (the old default here) and
`llama-4-scout` (the standard vision model) in 2026. This app now
defaults to `qwen/qwen3.6-27b`, which is Groq's current recommended
replacement for both — it handles text, vision, and reasoning in one
model, so there's no need to switch models when a feature needs
image understanding. If Groq's lineup changes again, check
`console.groq.com/docs/models` and update `GROQ_MODEL` in `.env`.

## Multilingual support

The 🌐/flag picker in the header controls two things at once:

- **UI language** — translates the app's interface strings (buttons,
  placeholders, empty states). Dictionary lives in
  `frontend/src/i18n.js`. Currently covers English, Hindi, Marathi,
  Spanish, French, German, Japanese, Chinese, and Arabic (with basic
  RTL text direction for Arabic — reading order flips, but pixel-
  positioned elements like the sidebar aren't mirrored; that's a
  deeper layout pass, not done here).
- **Response language** — a *preference*, not a hard override, passed
  to the backend as `response_language`. The assistant is told to
  prefer that language but to follow your lead if you write in
  something else or paste content that shouldn't be translated (code,
  error messages). "Auto" sends no instruction at all — default LLM
  behavior, replies in whatever language you write in.

These translations were written directly, not run through a separate
verification pass — if you're a native speaker of any of these and
something reads awkwardly, `frontend/src/i18n.js` is a plain object,
easy to fix.

## Camera & screen analysis

The 📷 and 🖥️ buttons in the composer open a real live preview
(camera via `getUserMedia`, screen via `getDisplayMedia`) — you see
the actual feed, then click "Capture frame" to grab one frame and
attach it to your next message. That frame gets sent to Groq's vision
model (`qwen/qwen3.6-27b`) alongside your text.

Worth being precise about what this is and isn't: it's live preview
with on-demand capture, not continuous real-time analysis of every
frame while you watch. That'd need a fundamentally different
(streaming, much more expensive) architecture — this uses the same
snapshot-on-demand pattern most camera-input chat features actually
use under the hood.

One real trade-off worth knowing: captured images are stored as
base64 directly in the chat session (so they persist in
`localStorage` like the rest of your history). Browsers cap
`localStorage` at roughly 5–10MB per origin — fine for normal use,
but if you attach a lot of images across a lot of chats over time,
you could eventually hit that ceiling. Not something this build
guards against yet.

## Message actions & concise mode

Hover any message to reveal:
- **Copy** (📋) — on any message, copies its text to your clipboard.
- **Regenerate** (🔄) — assistant messages only. Drops that reply
  (and anything after it, if you'd branched further) and re-asks the
  same preceding question fresh. Doesn't resend the old, discarded
  reply as context — it's a clean retry, not a continuation.
- **Reactions** (👍/👎) — assistant messages only. A personal marker
  you can toggle on/off by clicking again. This is local-only, stored
  with the message in your session — it doesn't get sent anywhere or
  train anything; it's just a way to flag responses for yourself.

The **⚡ Concise** toggle in the header is a global preference (all
chats, persisted) that tells the model to prioritize short, direct
answers over thorough ones — cut preamble and restating the question,
keep substance. It's a request, not a hard limit, so genuinely
complex questions can still get the length they need.
