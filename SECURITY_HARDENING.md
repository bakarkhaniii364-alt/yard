# 🔐 Security Hardening Guide for Yard

**Last Updated:** May 25, 2026  
**Audit Status:** ✅ CLEAN (0 vulnerabilities)

---

## Executive Summary

Your application has a **strong security baseline**:
- ✅ Dependencies: 0 vulnerabilities
- ✅ RLS: Enabled on all sensitive tables
- ✅ Headers: Hardened with HSTS, CSP, X-Frame-Options
- ✅ Storage: Room-scoped access controls
- ⚠️ Recent fix: Removed non-functional CSP reporting endpoints

---

## Section 1: Content Security Policy (CSP) - FIXED ✅

### What Changed
- **Removed** broken `report-uri` and `Report-To` directives (caused 405 errors)
- **Removed** redundant `CSP-Report-Only` header
- **Added** defense-in-depth directives:
  - `base-uri 'self'` - prevents form-jacking attacks
  - `form-action 'self'` - restricts form submissions
  - `object-src 'none'` - blocks Flash, plugins, legacy code

### Current CSP Directives Explained

```
default-src 'self'
  ↳ Everything blocked by default; only same-origin allowed

connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org https://api.open-meteo.com https://wttr.in https://api.tvmaze.com https://imdb.iamidiotareyoutoo.com https://api.themoviedb.org …
  ↳ Supabase, geocode, weather, Cinema APIs (TVmaze / TMDb / IMDb proxy), WebRTC, Sentry — see docs/CSP_FIX_PLAN.md

style-src 'self' https://fonts.googleapis.com
  ↳ Inline styles (dynamic CSS) are safe; no 'unsafe-inline' needed
  ↳ Google Fonts whitelisted

img-src 'self' data: blob: https://*.supabase.co https://api.dicebear.com
  ↳ Canvas doodles (blob:), user uploads (Supabase), avatars (dicebear)

worker-src 'self' blob:
  ↳ Service workers allowed (PWA functionality)

frame-src 'self' https://www.youtube.com https://youtube.com
  ↳ YouTube embeds only; no arbitrary iframes
```

### Why No `unsafe-inline` or Nonce?
- Your build uses **Tailwind CSS** (class-based, no inline styles)
- Inline `style={}` in React components contain **only values** (colors, widths), not event handlers
- ✅ CSP allows this without `unsafe-inline`

---

## Section 2: HTTP Security Headers - COMPLETE ✅

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS for 2 years; included in preload list |
| `X-Frame-Options` | `DENY` | Prevents clickjacking (iframe attacks) |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-sniffing attacks |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter (defense-in-depth) |
| `X-Permitted-Cross-Domain-Policies` | `none` | Blocks Adobe Flash cross-domain requests |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Leaks minimal info in cross-site requests |
| `Permissions-Policy` | `camera=(self), microphone=(self), geolocation=(self), ...` | Disables unused APIs (USB, payments, magnetometer) |
| `Content-Security-Policy` | [See CSP section above] | Multi-directive attack prevention |

---

## Section 3: Database Security (Row Level Security) ✅

### Current RLS Implementation

**Status:** ✅ ENABLED on all sensitive tables
- `rooms`
- `chat_messages`
- `shared_assets`
- `user_stats`
- `room_metadata`
- `arcade_sessions`
- `room_player_stats`
- `pair_attempt_log`
- `highscores`

### RLS Policy Highlights

#### 1. **Pairing Rate Limiting** (Anti-Brute-Force)
```sql
-- File: docs/db/security_hardening.sql
-- Prevents 10+ pairing attempts in 15 minutes
-- Blocks brute-force attacks on room codes
```
✅ **Status:** Enabled with SECURITY DEFINER function

#### 2. **Storage Access Control** (Room-Scoped)
```sql
-- File: docs/db/storage_policies.sql
-- Users can only read/write objects in their active rooms
-- Prevents cross-room file scraping
```
✅ **Status:** Implemented via `user_can_access_storage_object()` function

#### 3. **Verify All RLS Policies**
To audit your Supabase RLS, run this in your Supabase SQL Editor:

```sql
-- Check which tables have RLS enabled
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true
ORDER BY tablename;

-- Check RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

---

## Section 4: Dependency Security - CLEAN ✅

### Audit Results
```
✅ Critical vulnerabilities: 0
✅ High vulnerabilities: 0
✅ Moderate vulnerabilities: 0
✅ Low vulnerabilities: 0
✅ Info vulnerabilities: 0

Total dependencies: 737 (177 prod, 561 dev)
```

### Automated Security Monitoring

**Enable on GitHub:**
1. Go to Settings → Security → Dependabot
2. ✅ Enable "Dependabot alerts"
3. ✅ Enable "Dependabot security updates"
4. ✅ Enable "Grouped security updates"

**Or use Snyk (CLI):**
```bash
npm install -g snyk
snyk auth
snyk monitor
```

**Regular audits:**
```bash
# Monthly
npm audit

# Before production deployments
npm audit --audit-level=moderate
```

---

## Section 5: Environment & Secrets - CRITICAL ⚠️

### Checklist

- [ ] **Never commit `.env` files to Git**
- [ ] **Never commit API keys, tokens, or secrets to Git history**
- [ ] **Verify no secrets in current commits:**
  ```bash
  git log --all --full-history -p --grep="SUPABASE_KEY\|API_KEY\|SECRET" | head -50
  ```

### Vercel Environment Variables

For **Vercel deployment**, set secrets in:
1. Vercel Dashboard → Project Settings → Environment Variables
2. Add variables for each environment (Preview, Production, Development)

**Required variables:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  (anonymous key, safe to expose)
```

**Don't expose in build:**
```javascript
// ✅ GOOD - only prefix with VITE_ if truly public
VITE_SUPABASE_ANON_KEY

// ❌ BAD - never put secrets here
SUPABASE_SERVICE_ROLE_KEY=... (backend-only, never in frontend)
```

---

## Section 6: Inline Style Safety Analysis ✅

### Findings

Scanned: `src/**/*.jsx` for `style={}` attributes

**Result:** ✅ All safe patterns found

**Examples from codebase:**
```jsx
// ✅ SAFE - Only dynamic values
<div style={{ backgroundColor: c }} />
<div style={{ width: `${progressPct}%` }} />
<canvas style={{ touchAction: 'none' }} />

// ✅ SAFE - No event handlers
<div style={{ 
  backgroundImage: 'radial-gradient(...)', 
  backgroundSize: '20px 20px' 
}} />
```

**No CSP violations** because:
1. No `on*` event handlers in style attributes
2. No `javascript:` URLs
3. Values are escaped by React
4. CSS-in-JS uses class-based approach (Tailwind)

---

## Section 7: Deployment Security Checklist

### Pre-Deployment

- [ ] Run `npm audit` and ensure clean results
- [ ] Run `npm run build` without warnings
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Review CSP violations in browser DevTools (F12 → Console)
- [ ] Verify HTTPS redirect is working
- [ ] Confirm all security headers in DevTools:
  ```
  F12 → Network → [any request] → Headers → Response Headers
  ```

### Production Verification

After deploying to Vercel:
```bash
# Check security headers
curl -I https://your-domain.com | grep -i "strict-transport-security\|x-frame-options\|x-content-type-options"

# Or use online tool:
# https://securityheaders.com/?q=your-domain.com
```

### Monitoring

1. **Supabase Logs:** Dashboard → Logs → check for suspicious activity
2. **Vercel Analytics:** Vercel Dashboard → Analytics → check error rates
3. **GitHub Security:** Repo → Security → check for Dependabot alerts

---

## Section 8: Attack Surface Reduction

### Currently Implemented

✅ **Principle of Least Privilege**
- `object-src 'none'` - blocks Flash/plugins
- `base-uri 'self'` - prevents form injection
- `form-action 'self'` - restricts form targets
- RLS policies - users only see their own data
- Rate limiting on pairing - prevents brute-force

✅ **Defense-in-Depth**
- CSP (browser-level enforcement)
- RLS policies (database-level enforcement)
- HTTP security headers (client instructions)
- Input validation (React/Tailwind safe)

### Recommended Future Enhancements

1. **Content Security Policy Monitoring**
   - Set up CSP monitoring service (e.g., Sentry, Report-Uri.com)
   - Track and respond to CSP violations in production

2. **Supabase Audit Logs**
   - Enable audit logging for sensitive operations
   - Monitor failed authentication attempts

3. **Rate Limiting on API**
   - Extend rate limiting to all endpoints (not just pairing)
   - Implement per-IP limits using Vercel Middleware

---

## Section 9: Incident Response Plan

### If You Suspect a Breach

1. **Immediate Actions**
   - [ ] Revoke compromised secrets in Supabase Dashboard
   - [ ] Check git log for exposed keys:
     ```bash
     git log --all --full-history -p | grep -i "key\|secret\|token" | head -20
     ```
   - [ ] If found, use `git-filter-branch` or `BFG Repo Cleaner` to remove

2. **Notify Affected Users**
   - [ ] Send email: "We discovered a security issue and have taken corrective action"
   - [ ] Recommend password reset (if auth is affected)

3. **Post-Mortem**
   - [ ] Update `.gitignore` to prevent future commits
   - [ ] Add pre-commit hook:
     ```bash
     npm install -D husky lint-staged
     husky install
     echo 'npm audit' > .husky/pre-commit
     ```

---

## Section 10: Security Update Cadence

| Task | Frequency | Owner |
|------|-----------|-------|
| `npm audit` | Weekly | Dev team |
| Update critical dependencies | ASAP | Security lead |
| Update other dependencies | Monthly | Dev team |
| Security header review | Quarterly | Security review |
| RLS policy audit | Quarterly | DB admin |
| Full security audit | Annually | External auditor |

---

## Quick Reference: Key Files

| File | Purpose | Status |
|------|---------|--------|
| [public/_headers](../public/_headers) | Vercel security headers | ✅ Updated |
| [docs/db/auth_schema.sql](../docs/db/auth_schema.sql) | RLS policy definitions | ✅ Reviewed |
| [docs/db/storage_policies.sql](../docs/db/storage_policies.sql) | Storage access control | ✅ Reviewed |
| [docs/db/security_hardening.sql](../docs/db/security_hardening.sql) | Rate limiting & additional policies | ✅ Reviewed |

---

## Questions?

- **CSP violations?** Check `src/index.css` and `vite.config.js` for build-time issues
- **RLS not working?** Verify `auth.uid()` is set in Supabase Auth context
- **Headers not sending?** Ensure `public/_headers` is deployed (Vercel requires it)

---

**Last audit:** May 25, 2026  
**Next scheduled audit:** August 25, 2026
