# VTX — Bangla → English Video Voice-Over Dashboard

VTX is the review UI for an automation that turns Bangla screen-recorded walkthroughs into English
voice-overs spoken in the CEO's cloned voice. This repo is **only the dashboard** — it never calls
Gemini, ElevenLabs, or the Google Drive API with secrets. It talks to three things:

- **Supabase** (auth + Postgres, via the public anon key, protected entirely by Row Level Security)
- **Three n8n webhooks**, authenticated with the signed-in user's Supabase access token
- **Google Drive**, only for the one-time browser → Drive resumable upload of the source video

The rest of the pipeline (Gemini scripting, ElevenLabs TTS, ffmpeg merge, Drive upload of the
final file) is a separate n8n workflow, not part of this codebase.

## What it does

1. A developer uploads a Bangla walkthrough. The file goes straight from their browser to a Google
   Drive "Input" folder using a resumable-upload URL that n8n hands back.
2. n8n sends the video to Gemini, which writes a timed English script and saves it to Supabase.
   The video's status becomes `script_ready`.
3. The CEO opens the video, reads Bangla and English side by side, edits the English, previews
   the timing with the browser's built-in text-to-speech, and clicks **Approve and Generate**.
4. n8n generates voice-over audio with ElevenLabs (only for segments whose text changed since the
   last generation), merges it with ffmpeg, uploads the result to a Drive "Output" folder, and
   marks the video `done` with a link to the final file.

## Tech stack

Vite + React 18 + TypeScript (strict) + Tailwind CSS + `@supabase/supabase-js` v2 +
`react-router-dom` v6 + `@tanstack/react-query`. Icons from `lucide-react`, small class-name
helper from `clsx`. Deployed to Netlify as a static SPA.

## Local setup

```bash
npm install
npm run dev
```

By default the repo ships with a local `.env` that has `VITE_DEMO_MODE=true`, so `npm run dev`
works immediately with **no backend at all** — see Demo mode below. To point it at a real
Supabase project and n8n instance, copy `.env.example` to `.env` (or edit it directly) and fill in
real values.

```bash
npm run build   # type-checks (tsc -b) then builds with Vite — must be zero TS errors
npm run lint    # oxlint — must be clean
npm run preview # serve the production build locally
```

## Environment variables

See `.env.example`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=public-anon-key
VITE_N8N_BASE_URL=https://n8n.example.com/webhook
VITE_DRIVE_INPUT_FOLDER_URL=https://drive.google.com/drive/folders/xxxx
VITE_DEMO_MODE=false
```

- `VITE_N8N_BASE_URL` is the production webhook base (it ends in `/webhook`). The dashboard calls
  `${VITE_N8N_BASE_URL}/vtx/upload-session`, `/vtx/video-uploaded`, and `/vtx/generate`.
- Nothing else goes in the frontend. There is no service-role key, no ElevenLabs key, no Gemini
  key, and no server component here — it's a static SPA.

## Demo mode

When `VITE_SUPABASE_URL` is empty or `VITE_DEMO_MODE=true`, the whole app runs against an
in-memory mock (`src/lib/demoApi.ts`) instead of Supabase/n8n — no backend needed at all. It seeds:

- 4 sample videos, one in each of `scripting`, `script_ready`, `done`, and `failed`
- 6–8 Bangla/English segment pairs per script-bearing video, including one with a review note and
  one over its word limit, so every UI state is visible without configuring anything
- A settings row and a fake logged-in user
- A **CEO / Dev role switcher** in the top bar (demo mode only) so you can see both permission
  views without signing in and out

Uploads, script generation, and voice generation are all simulated with timers so you can click
through the entire flow — New video → Drive link or file upload → scripting → script review →
Approve and Generate → done, with a sync report — end to end.

All data access goes through a single interface (`src/lib/api.ts`) with two implementations,
`supabaseApi` and `demoApi`; which one the app uses is a single `isDemoMode` check, so nothing
else in the codebase knows or cares which backend it's talking to.

## Data model

The tables already exist in Supabase (`profiles`, `settings`, `videos`, `segments`) — this repo
does not create migrations. `src/types.ts` mirrors the schema. A few things worth knowing:

- Numeric columns can come back from Supabase as strings; `supabaseApi` coerces them with `Number()`.
- `videos.sync_report` may arrive as a JSON string or an already-parsed array — read it with
  `parseSyncReport()` from `src/types.ts`, which handles both.
- Rows are never inserted or deleted from the browser. n8n creates video rows and changes their
  status; the dashboard only ever updates `segments.english_text` and the editable `settings`
  columns, and only as the CEO.

### Row Level Security (what the UI is designed around)

- Everyone can **read** `profiles` (their own row; the CEO can read all), `settings`, `videos`,
  and `segments`.
- Only the **CEO** can update `segments.english_text` — and only while the video's status is
  `script_ready`, `done`, or `failed` — and the editable `settings` columns (`voice_id`,
  `tts_model`, `stability`, `similarity`, `speed_cap`, `words_per_sec`, `style_sample`,
  `glossary`).
- Nobody can insert or delete rows from the browser.
- There's no public sign-up page — users are invited by email from the Supabase dashboard. The
  login page handles both a normal sign-in and the "set your password" step after an invite or
  password-recovery link.

## The segment-audio hash

`src/lib/hash.ts` has an FNV-1a hash used to decide whether a segment's generated audio still
matches its current text and voice settings ("Audio is up to date" vs. "Will be regenerated").
**This must stay byte-identical to the copy running in n8n** — same algorithm, same field order,
same handling of a `null` voice ID — or the two sides will disagree about which segments need
regenerating.

## n8n webhook contract

All three endpoints are `POST`, JSON body, with header `Authorization: Bearer <supabase access
token>`. A `401` signs the user out and sends them to `/login`; a `409` and network errors are
shown as a toast with a human-readable message.

- **`POST {base}/vtx/upload-session`** — `{ fileName, mimeType, size }` → `{ uploadUrl }`, a Drive
  resumable-upload session URL.
- **`POST {base}/vtx/video-uploaded`** — new video: `{ driveFileId, title, durationSec }`; retry
  (re-run scripting): `{ videoId }`. → `{ videoId }`.
- **`POST {base}/vtx/generate`** — `{ videoId }` → `202 { ok: true }` (the n8n workflow keeps
  running in the background; the dashboard polls the video's status). A `409` means "not allowed
  or already running."

## Upload flow

The New Video dialog uploads directly from the browser to the Drive resumable-upload URL with a
single `PUT` via `XMLHttpRequest` (not `fetch`, so real upload progress is observable), shows a
progress bar and a Cancel button, and warns on `beforeunload` while uploading. If the direct PUT
fails (CORS/network), it falls back to a "Add from Drive link" tab where you paste a Drive share
link (or bare file ID) and a title instead — no network upload needed.

## Deploying to Netlify

1. Push this repo to GitHub and connect it in Netlify ("Import an existing project").
2. Build command `npm run build`, publish directory `dist` — already set in `netlify.toml`
   (`public/_redirects` is included too, so the SPA fallback works even without it).
3. Add the environment variables from `.env.example` in Netlify's Site settings → Environment
   variables, with real values (and `VITE_DEMO_MODE=false`).
4. Deploy, then take the resulting Netlify URL and add it to:
   - **Supabase** → Authentication → URL Configuration: set it as the Site URL and add it (plus
     `/login`) to Redirect URLs, so magic links and invite/recovery links work.
   - **n8n** → each of the three webhook nodes' Allowed Origins / CORS settings.

## Notes and decisions made while building this

- Tailwind v3 is used (not v4) for the more mature ecosystem/tooling at the time of writing; the
  brief allowed either.
- The project's Vite template ships with `oxlint` instead of ESLint — it's what `npm run lint`
  runs, and it's kept fully clean (zero errors, zero warnings).
- Dark mode follows `prefers-color-scheme` only, as specified — there's no manual toggle.
- The "Preview (browser voice)" feature uses `speechSynthesis` purely for rough timing feedback
  (it's free and has no API key); it intentionally has nothing to do with the real ElevenLabs
  voice used by n8n.
