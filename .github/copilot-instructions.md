## 🧭 Stash — Copilot / AI Agent Guide

**Purpose:** Give AI coding agents the essential, actionable knowledge to be immediately productive in this repo.

---

## Architecture (big picture) 🔧
- Chrome Extension (`extension/`) — background service worker (`background.js`), content script (`content.js`), minimal Supabase client (`supabase.js`) and `Readability.js`. Handles user actions, content extraction, uploads, and triggers server-side Edge functions.
- Web App (`web/`) — single-page vanilla JS app (`web/app.js`) running in single-user mode by default (`CONFIG.USER_ID`). Uses Supabase JS client for reads/writes and DOM-driven UI (no frameworks).
- Supabase (`supabase/`) — `schema.sql` defines tables, indexes, and critical Row-Level Security (RLS) policies. Edge Functions (`supabase/functions/*`) are Deno TypeScript and call external APIs (OpenAI, Resend) and write back to the DB using the Service Role key.
- Background services — `tts/tts.py` runs an Edge-TTS generator that uploads audio to Supabase storage.

---

## Key developer workflows ✅
- Local extension testing: Load `extension/` as an unpacked extension in Chrome (`chrome://extensions` > Developer mode > Load unpacked`). Use browser devtools console for logs.
- Web dev server: quick local server: `cd web && python3 -m http.server 3000` (or deploy to Vercel/Netlify with `web` as the root).
- Supabase schema: run `supabase/schema.sql` in Supabase SQL editor to create tables + RLS.
- Deploy Edge functions (Deno/TypeScript):
  - Install Supabase CLI: `npm i -g supabase`
  - `supabase login` → `supabase link --project-ref <id>` → `supabase functions deploy <function-name>`
- TTS daemon: `pip install edge-tts requests` then run `python tts/tts.py` (daemon) or `python tts/tts.py --once` (single run). Update constants at top of `tts.py`.

---

## Project-specific conventions & patterns 🧩
- Single-user vs Multi-user:
  - Default single-user mode uses a hardcoded `USER_ID` in `extension/config.js` and `web/config*.js` for simple installs.
  - To enable multi-user, remove `USER_ID` from configs and rely on Supabase Auth + RLS.
- Keys and permissions:
  - Browser clients use the `anon` key (`CONFIG.SUPABASE_ANON_KEY`) — limited and subject to RLS.
  - Server-side Edge Functions require `SUPABASE_SERVICE_ROLE_KEY` (Deno env) for privileged operations.
- Minimal Supabase usage: extension uses a tiny custom `SupabaseClient` (REST endpoints via `fetch`) in `extension/supabase.js` — prefer matching that style when touching extension code.
- Feature flags: `CONFIG.FEATURES` (example: `VISION_V2`) controls UI/behavior — see `web/app.js` for how flags are applied.
- Content extraction: primary logic in `extension/content.js` (heuristics + Readability). Prefer changing selectors/heuristics here for better extraction results.

---

## Integration points & external dependencies 🛰️
- Supabase REST & Edge Functions — primary backend. Look at `supabase/schema.sql` and each function in `supabase/functions/*`.
- OpenAI Vision / Embeddings — functions like `generate-image-embedding` require `OPENAI_API_KEY` and process images (see that function for the exact model / payload expectations).
- Email sending via Resend — `send-digest` needs `RESEND_API_KEY` and the `from` address set.
- TTS uses `edge-tts` locally; uploads to Supabase Storage bucket (create `uploads` and `audio` buckets as needed).

---

## Debugging & quick checks ⚠️
- Extension issues: open the extension background page and the active tab console. Look for console logs in `background.js` and messages from `content.js`.
- 403 / permission errors: check RLS policies and whether requests are using `anon` vs `service_role` key.
- Edge function errors: inspect Supabase function logs (Supabase dashboard) and ensure required Deno env vars (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`) are set.
- CORS problems: Edge functions include CORS headers; ensure requests include `apikey` header and proper method.

---

## Concrete examples (copy-paste friendly) 💡
- Triggering server auto-tag (background, fire-and-forget):
  - In `extension/background.js` the function `triggerAutoTag(saveId, userId)` calls `${SUPABASE_URL}/functions/v1/auto-tag` with `apikey` + `Authorization` headers.
- Server-side save (Edge function):
  - `supabase/functions/save-page/index.ts` expects JSON: `{ url, user_id, highlight?, source?, prefetched? }` and needs `SUPABASE_SERVICE_ROLE_KEY` in Deno env.
- Toggle dev web config in browser:
  - `localStorage.setItem('stash-env', 'dev')` (or `'prod'`) to override which `web/config.*.js` is used.

---

## Where to look first when changing behavior 🔭
- Extraction / Save behavior: `extension/content.js`, `Readability.js`, `extension/background.js`
- DB schema / RLS: `supabase/schema.sql`
- Server-side AI flows: `supabase/functions/*` (look for OpenAI usage and env requirements)
- UI flags / feature gating: `web/config.*.js` and `web/app.js`

---

## Notes for AI agents ✍️
- Be explicit: reference file paths and small code snippets when proposing changes (e.g., "update `extractProductData()` in `extension/content.js` to include selector X").
- Avoid making auth assumptions — prefer changes that preserve single-user mode unless explicitly asked to implement multi-user behavior and RLS updates.
- No test suite is present; indicate if you add tests and include run instructions (where to run and how).

---

If anything here is unclear or you'd like more detail (examples of function payloads, common console messages, or prioritized first-tasks), tell me which area to expand and I'll iterate. ✅
