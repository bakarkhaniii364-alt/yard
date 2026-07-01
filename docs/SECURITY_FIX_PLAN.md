# Database & Application Security Fix Plan

**Created:** May 25, 2026  
**Source audit:** [DATABASE_SECURITY_AUDIT.md](../DATABASE_SECURITY_AUDIT.md)  
**Task tracker:** [SECURITY_FIX_TASKS.md](./SECURITY_FIX_TASKS.md)  
**Overall rating (audit):** 6.5/10 — solid RLS foundation, critical gaps in definer RPCs, audit logging, storage validation, CSP

---

## Executive summary

Yard has room-scoped RLS and most migrations deployed. The highest **real** risk is not classic SQL injection on RPC parameters (Postgres binds them), but **privilege escalation**: `SECURITY DEFINER` functions that mutate data without verifying `auth.uid()` owns the target room.

Realtime is **partially mitigated** in the app via `room_id=eq.{roomId}` filters on subscriptions; still requires a live cross-user test.

**Verified in Supabase (May 25, 2026):** All required RPCs exist in `public`:

| Group | Functions |
|-------|-----------|
| App state / sync | `merge_app_state`, `update_app_state_atomic` |
| Pairing | `pair_with_code` |
| Arcade | `join_arcade_session`, `set_arcade_ready` (2 overloads), `leave_arcade_session` |
| Room / account | `get_my_room`, `leave_room`, `delete_my_room`, `delete_user_data` |

---

## Audit vs reality

| Finding | Audit claim | Repo / production reality |
|---------|-------------|---------------------------|
| SQL injection via `p_key` | Critical | **Overstated** — parameters are bound; `jsonb_set(ARRAY[p_key])` is not dynamic SQL |
| Cross-room writes via definer RPCs | Critical (labeled SQLi) | **Accurate** — `merge_app_state` / `update_app_state_atomic` lack room membership checks |
| Realtime leaks all table rows | Critical | **Partially mitigated** — frontend uses `filter: room_id=eq.{roomId}`; RLS must still be verified |
| CSP `unsafe-inline` | Critical | **Accurate** — still in `public/_headers` line 9; conflicts with `SECURITY_HARDENING.md` |
| No audit logging | Critical | **Accurate** — no `audit_log` table |
| Storage MIME/size limits | Critical | **Accurate** — `storage_policies.sql` is room-path only |
| Type mismatch `text` vs `uuid` | Medium | Fixed in `docs/db/init.sql` + migrations; confirm column type in production |
| Rate-limited pairing | — | Implemented in `docs/db/security_hardening.sql`; confirm script was run in Supabase |

---

## App-state key whitelist (from `src/`)

Use this when hardening `merge_app_state` and `update_app_state_atomic`:

| Key | Usage |
|-----|--------|
| `room_profiles` | Profiles, activity, location (`SyncContext`, `ChatContext`, `useAppLogic`) |
| `couple_data` | Pet, nicknames, couple settings (`Dashboard`, `App`) |
| `arcade_lobby` | Lobby state (`ChatView`, `useGlobalSync`) |
| `game_scores` | Per-user scores (`App`) |
| `user_streaks` | Streak tracking (`useDashboardLogic`) |

Validation pattern:

```sql
IF p_key !~ '^[a-z_0-9]{1,50}$'
   OR p_key NOT IN ('room_profiles','couple_data','arcade_lobby','game_scores','user_streaks')
THEN
  RAISE EXCEPTION 'invalid key' USING ERRCODE = 'invalid_parameter_value';
END IF;
```

---

## Phase 0 — Verify & quick wins (~1–2 hours)

No schema changes required except confirming production state.

### 0.1 CSP — Completed ✅

- **File:** `public/_headers`
- **Change:** Removed `'unsafe-inline'` from `style-src`. Added required hosts to `connect-src`, `img-src`, `frame-src`, `media-src`, and `script-src`.
- **Status:** Done. No CSP violations on dashboard, chat, onboarding, arcade.


### 0.2 Database verification (SQL Editor)

**RPCs — DONE (verified May 25, 2026)**

```sql
-- Migration-critical RPCs
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'merge_app_state', 'update_app_state_atomic',
    'pair_with_code', 'join_arcade_session', 'set_arcade_ready', 'leave_arcade_session'
  );

-- Auth / room RPCs
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_my_room', 'leave_room', 'delete_my_room', 'delete_user_data'
  );
```

**Still run:**

```sql
-- RLS enabled on all public tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- app_state.room_id type
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_state'
  AND column_name = 'room_id';
-- Expected: uuid

-- Optional: duplicate set_arcade_ready overloads
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'set_arcade_ready';
```

**Confirm `security_hardening.sql` applied:** `pair_with_code` should rate-limit (10 attempts / 15 min). Test or inspect function body in Supabase.

### 0.3 Realtime isolation test

1. User A paired in room R — subscribe with `filter: room_id=eq.{R}` (matches `SyncContext.jsx`, `ChatContext.jsx`, etc.)
2. User C (unpaired) — same filter with guessed R UUID
3. User C must receive **no** payloads

Repeat for: `app_state`, `chat_messages`, `shared_assets`, `arcade_sessions`.

### 0.4 Supabase Auth password policy

Dashboard → **Authentication** → Email provider:

- Minimum length: 12
- Uppercase, lowercase, numbers: yes
- Symbols: optional (couples app UX)

### 0.5 Encryption at rest (documentation only)

Supabase Dashboard → Project Settings → Security. Document finding in `SECURITY_HARDENING.md` or README.

---

## Phase 1 — Critical fixes (~1 day)

**Deliverable:** New `docs/db/security_fixes_phase1.sql` (rerunnable patch) + mirror changes in source SQL files.

### 1.1 Shared helper: `user_owns_room`

```sql
CREATE OR REPLACE FUNCTION public.user_owns_room(p_room_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = p_room_id
      AND is_active = true
      AND (creator_id = auth.uid() OR partner_id = auth.uid())
  );
$$;
```

Every mutating `SECURITY DEFINER` RPC should:

1. `IF auth.uid() IS NULL THEN RAISE ...`
2. `IF NOT user_owns_room(p_room_id) THEN RAISE ...` (where applicable)
3. `SET search_path = public`

### 1.2 Harden app-state RPCs

| Function | File | Gaps | Fixes |
|----------|------|------|-------|
| `merge_app_state` | `migration_normalized.sql` | No auth/room check | Auth + `user_owns_room` + key whitelist |
| `update_app_state_atomic` | `migration_normalized.sql` | Same | Same |
| `join_arcade_lobby` | `migration_normalized.sql` | No auth; updates `rooms.app_state` | Add checks or deprecate (not called from `src/`) |

### 1.3 Harden arcade session RPCs

| Function | Fixes |
|----------|-------|
| `join_arcade_session` | `p_user_id = auth.uid()`, `user_owns_room` |
| `set_arcade_ready` | Same; drop stale overload if two exist |
| `leave_arcade_session` | Same |

### 1.4 Audit logging

**New table:** `public.audit_log`

- Columns: `id`, `user_id`, `action`, `table_name`, `old_data`, `new_data`, `error_message`, `created_at`
- RLS: policy `USING (false)` for all client access
- Log from: `pair_with_code`, `leave_room`, `delete_my_room`, `delete_user_data`, RPC denials

### 1.5 Storage validation

**File:** `docs/db/storage_policies.sql`

- Extend `user_can_access_storage_object(bucket, path, size)`
- Per-bucket extension regex + max bytes (doodles 10MB, scrapbook 50MB, voice 100MB)
- Policy passes `size` from `storage.objects`

**Frontend:**

| File | Change |
|------|--------|
| `src/utils/file.js` | `validateUpload(file, bucket)` |
| `src/hooks/useAssetSync.js` | Validate before upload |
| `src/context/ChatContext.jsx` | Validate voice/scrapbook uploads |
| `src/views/ChatView.jsx` | Tighten attachment checks |

---

## Phase 2 — High priority (1–2 weeks)

### 2.1 Supabase client (`src/lib/supabase.js`)

```javascript
createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
});
```

Document JWT on Realtime handshake in `SECURITY_HARDENING.md`.

### 2.2 Column-level security

Defer until PII tables exist. Pattern: views + limited RLS; `get_my_room` is already a good example.

### 2.3 Documentation reconciliation

Align:

- `DATABASE_SECURITY_AUDIT.md` (open findings)
- `SECURITY_HARDENING.md` (claims CSP fixed — incorrect until `_headers` updated)
- `docs/MIGRATION_EXECUTION_GUIDE.md` (add step for `security_fixes_phase1.sql`)

---

## Phase 3 — Optional / month

| Item | Notes |
|------|-------|
| Playwright security tests | Cross-user realtime negative test; rate limit on `pair_with_code` |
| GDPR automation | Timed deletion after `delete_user_data` |
| HIPAA | Only if health data is stored |

---

## SECURITY DEFINER inventory (12 functions)

| Function | Source file | Auth / room check |
|----------|-------------|-------------------|
| `pair_with_code` | `security_hardening.sql` | `auth.uid()` + rate limit |
| `get_my_room` | `auth_schema.sql` | Filters by `auth.uid()` |
| `leave_room` | `auth_schema.sql` | Membership check |
| `delete_user_data` | `auth_schema.sql` | Uses `auth.uid()` |
| `delete_my_room` | `migration_normalized.sql` | Membership via room lookup |
| `merge_app_state` | `migration_normalized.sql` | **Needs Phase 1** |
| `update_app_state_atomic` | `migration_normalized.sql` | **Needs Phase 1** |
| `join_arcade_lobby` | `migration_normalized.sql` | **Needs Phase 1 or deprecate** |
| `join_arcade_session` | `migration_normalized.sql` | **Needs Phase 1** |
| `set_arcade_ready` | `migration_normalized.sql` | **Needs Phase 1** |
| `leave_arcade_session` | `migration_normalized.sql` | **Needs Phase 1** |
| `user_can_access_storage_object` | `storage_policies.sql` | Room path (needs MIME/size in Phase 1) |

---

## File change map

```
Phase 0
  public/_headers
  (Supabase dashboard) — password policy, RLS verification

Phase 1
  docs/db/security_fixes_phase1.sql     ← NEW
  docs/db/migration_normalized.sql      ← mirror for greenfield
  docs/db/security_hardening.sql        ← audit_log hooks in pair_with_code
  docs/db/storage_policies.sql
  src/utils/file.js
  src/hooks/useAssetSync.js
  src/context/ChatContext.jsx

Phase 2
  src/lib/supabase.js
  SECURITY_HARDENING.md
  docs/MIGRATION_EXECUTION_GUIDE.md
```

---

## Supabase SQL execution order

1. **Backup** (Dashboard → Settings → Backups)
2. `docs/db/init.sql` — only if greenfield or `room_id` still `text`
3. `docs/db/migration_normalized.sql`
4. `docs/db/security_hardening.sql`
5. `docs/db/storage_policies.sql`
6. `docs/db/security_fixes_phase1.sql` — after Phase 1 is authored

---

## Risk priority (what matters most)

```
Phase 0 (verify + CSP)
    ↓
Phase 1: user_owns_room + RPC auth checks  ← highest impact
    ↓
Phase 1: audit_log + storage validation
    ↓
Phase 2: client config + docs
    ↓
Phase 3: automated tests
```

---

## Frontend RPC reference

| RPC | Called from |
|-----|-------------|
| `get_my_room` | `AuthContext`, `Onboarding`, `SettingsView`, `userDataHelpers` |
| `pair_with_code` | `Onboarding` |
| `leave_room` | `SettingsView` |
| `delete_my_room` | `SettingsView` |
| `merge_app_state` | `SyncContext` |
| `update_app_state_atomic` | `SyncContext`, `ChatContext`, `useAppLogic`, `useDashboardLogic`, games |
| `join_arcade_session` | `useArcadeSession` |
| `set_arcade_ready` | `useArcadeSession` |
| `leave_arcade_session` | `useArcadeSession` |

`join_arcade_lobby` — defined in migration only; **not used** in `src/`.

---

## Realtime subscription reference

| Table | Filter pattern | Source |
|-------|----------------|--------|
| `app_state` | `room_id=eq.{roomId}` | `SyncContext.jsx` |
| `chat_messages` | `room_id=eq.{roomId}` | `ChatContext.jsx` |
| `shared_assets` | room-scoped channel | `useAssetSync.js` |
| `arcade_sessions` | room + game | `useArcadeSession.js` |

---

## Reference links

- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MIGRATION_EXECUTION_GUIDE.md](./MIGRATION_EXECUTION_GUIDE.md)

---

**Next review:** 90 days after Phase 1 deployment  
**Questions:** See [DATABASE_SECURITY_AUDIT.md](../DATABASE_SECURITY_AUDIT.md) and [SECURITY_HARDENING.md](../SECURITY_HARDENING.md)
