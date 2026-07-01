# Content Security Policy (CSP) — Audit & Fix Plan

**Created:** May 25, 2026  
**Config file:** `public/_headers` (applied on Netlify / Cloudflare Pages deploy)  
**Task tracker:** [SECURITY_FIX_TASKS.md](./SECURITY_FIX_TASKS.md)

---

## What happened (your console errors)

When you search **“inception”** in **Sync Watcher / Cinema**, the app calls:

| URL | Purpose | CSP directive |
|-----|---------|---------------|
| `https://api.tvmaze.com/search/shows?q=...` | TV show search (keyless) | `connect-src` |
| `https://imdb.iamidiotareyoutoo.com/search?q=...` | Movie search proxy (keyless) | `connect-src` |

Your CSP `connect-src` only allowed Supabase, fonts, Nominatim, WebRTC, etc. The browser **blocked** those fetches → `Failed to fetch` / `violates Content Security Policy`.

This is the **same class of bug** as the earlier Nominatim geocode error: the app code is fine; the **allowlist in `_headers`** was incomplete.

---

## Root cause

CSP is a **whitelist**. Every `fetch()`, WebSocket, iframe, external image, and third-party script must match a directive in `public/_headers`.

The project added features (Cinema, weather, geocode, games) faster than the CSP list was updated → **whack-a-mole** CSP failures in production.

---

## Full external dependency audit

### `connect-src` (Fetch / XHR / WebSocket)

| Host | Source file | Feature | Status |
|------|-------------|---------|--------|
| `*.supabase.co` / `wss://` | App-wide | DB, auth, storage, realtime | Was allowed |
| `nominatim.openstreetmap.org` | `useDashboardLogic.js` | Reverse geocode (city name) | Fixed earlier |
| `api.open-meteo.com` | `useDashboardLogic.js` | Weather forecast | **Was blocked** → fixed |
| `wttr.in` | `WeatherWidget.jsx` | Weather broadcast | **Was blocked** → fixed |
| `api.datamuse.com` | `utils/helpers.js` | Word game dictionary | **Was blocked** → fixed |
| `api.tvmaze.com` | `SyncWatcher.jsx` | Cinema TV search / episodes | **Was blocked** → fixed |
| `imdb.iamidiotareyoutoo.com` | `SyncWatcher.jsx` | Cinema movie search (third-party proxy) | **Was blocked** → fixed |
| `api.themoviedb.org` | `SyncWatcher.jsx` | Cinema search when `VITE_TMDB_API_KEY` set | **Was blocked** → fixed |
| `*.workers.dev` | `webrtc.js` | TURN credential worker | **Was blocked** → fixed |
| `*.metered.ca` / `turn:` / `stun:` | WebRTC / `.env` | Voice/video calls | Was allowed |
| `*.ingest.sentry.io` / `*.sentry.io` | Sentry (if DSN set) | Error reporting | **Was blocked** → fixed |
| `fonts.googleapis.com` / `gstatic` | Fonts | Typography | Was allowed |

### `img-src` (posters & avatars)

| Host | Source | Status |
|------|--------|--------|
| `api.dicebear.com` | Avatars | Was allowed |
| `*.supabase.co` | Uploads | Was allowed |
| `static.tvmaze.com` | TVmaze posters | **Was blocked** → fixed |
| `image.tmdb.org` | TMDb posters | **Was blocked** → fixed |
| `m.media-amazon.com` / `*.media-amazon.com` | IMDb proxy posters | **Was blocked** → fixed |

### `frame-src` (iframes — video players)

| Host | Source | Status |
|------|--------|--------|
| `youtube.com` / `www.youtube.com` | Sync Watcher / YouTube | Was allowed |
| `vidsrc.su`, `vidsrc.cc`, `vidsrcme.ru`, `vidsrc-embed.su` | `embed.js` / SyncWatcher | **Was blocked** → fixed |
| `multiembed.mov`, `vidlink.pro`, `www.vidking.net` | Embed providers | **Was blocked** → fixed |

Without `frame-src` fixes, search might work but **playback iframe** would fail next.

### `media-src` (audio)

| Host | Source | Status |
|------|--------|--------|
| `www.soundhelix.com` | `LofiPlayer.jsx` demo tracks | **Was blocked** → fixed |

### `script-src`

| Host | Source | Status |
|------|--------|--------|
| `browser.sentry-cdn.com` | `monitoring.js` | **Was blocked** → fixed |

---

## Security notes (not just CSP)

### Third-party IMDb proxy

`imdb.iamidiotareyoutoo.com` is a **public CORS proxy**, not an official IMDb API.

| Risk | Mitigation (future) |
|------|---------------------|
| Proxy can log queries | Prefer official TMDb with `VITE_TMDB_API_KEY` |
| Proxy uptime / ToS | Your own Edge Function proxying TMDb/OMDb |
| Supply-chain trust | Document dependency; monitor for outages |

**Recommendation:** Set `VITE_TMDB_API_KEY` in production and treat TVmaze + IMDb proxy as fallback only.

### Video embed domains

`frame-src` allows many streaming embed hosts. Those sites are **not controlled by you** — they may show ads or redirect. UI already warns for non-sandbox providers (`SyncWatcher.jsx`).

---

## Fix applied in `public/_headers`

One comprehensive update (May 25, 2026) adds all audited hosts to the correct directives. After deploy, test the matrix below.

---

## Step-by-step: deploy & verify

### Step 1 — Save & commit

Ensure `public/_headers` includes the new hosts (already updated in repo).

### Step 2 — Deploy

Push to your host (e.g. Cloudflare Pages `yard-5gp.pages.dev`). CSP is **not** applied by Vite dev server the same way — test on **production URL**.

### Step 3 — Hard refresh

`Ctrl+Shift+R` (or clear cache) so the browser loads new response headers.

### Step 4 — Confirm header

1. DevTools → **Network** → reload document  
2. Click HTML document → **Response Headers**  
3. Find `content-security-policy`  
4. Confirm it contains `api.tvmaze.com` and `imdb.iamidiotareyoutoo.com`

### Step 5 — Feature test matrix

| # | Action | Expected |
|---|--------|----------|
| 1 | Dashboard → allow location | City name loads, no Nominatim CSP error |
| 2 | Sync Watcher → search “inception” | Results list, no TVmaze/IMDb CSP errors |
| 3 | Select a show → play | Iframe loads (no `frame-src` violation) |
| 4 | Posters in search results | Images visible (no `img-src` violation) |
| 5 | Lofi player (if used) | Audio plays |
| 6 | Voice call (optional) | TURN worker fetch OK |

### Step 6 — If something still fails

1. Read the exact URL in the console CSP message  
2. Add that host to the matching directive in `_headers`  
3. Redeploy  
4. Add a row to the audit table in this doc (avoid repeat whack-a-mole)

---

## Long-term improvements (optional)

| Priority | Task | Why |
|----------|------|-----|
| High | Add `scripts/audit-csp.js` — grep `fetch('https://` in `src/` and diff vs `_headers` | Prevents drift |
| High | CI check: fail build if new `https://` fetch host not in `_headers` | Automated |
| Medium | Replace IMDb proxy with Edge Function + TMDb | Security + reliability |
| Medium | Remove `'unsafe-inline'` from `style-src` | Security audit Phase 0 |
| Low | Move CSP to `vite-plugin` or platform config with comments per host | Maintainability |

### Example audit script (future)

```bash
# List all https origins used in fetch() calls
rg "fetch\(\`https://([^/'\"]+)" -o src/ --replace '$1' | sort -u
```

Compare output to `connect-src` in `public/_headers`.

---

## Directive quick reference

| User action | Browser checks |
|-------------|------------------|
| `fetch('https://api.tvmaze.com/...')` | `connect-src` |
| `<img src="https://static.tvmaze.com/...">` | `img-src` |
| `<iframe src="https://vidsrc.su/embed/...">` | `frame-src` |
| `<audio src="https://www.soundhelix.com/...">` | `media-src` |
| `<script src="https://browser.sentry-cdn.com/...">` | `script-src` |

---

## Related docs

- [SECURITY_FIX_PLAN.md](./SECURITY_FIX_PLAN.md) — database security phases  
- [SECURITY_FIX_TASKS.md](./SECURITY_FIX_TASKS.md) — checklist  
- [SECURITY_HARDENING.md](../SECURITY_HARDENING.md) — header overview (update `connect-src` section after deploy)

---

## Session log

| Date | Change |
|------|--------|
| 2026-05-25 | Nominatim added to `connect-src` |
| 2026-05-25 | Full CSP audit; TVmaze, IMDb proxy, TMDb, weather, embeds, images, Sentry, workers |
