# 🔐 Supabase RLS Audit & Configuration Guide

## Quick Start: Verify Your RLS Setup

Run this SQL in your **Supabase SQL Editor** (Dashboard → SQL):

```sql
-- ============================================================
-- PART 1: Verify RLS is enabled on all sensitive tables
-- ============================================================

SELECT 
  schemaname,
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

-- Expected output: All tables should show ✅ ENABLED
```

If any critical table shows ❌ DISABLED, run:
```sql
-- Enable RLS on the table
ALTER TABLE public.TABLE_NAME ENABLE ROW LEVEL SECURITY;

-- Drop default public access (if exists)
DROP POLICY IF EXISTS "default_policy" ON public.TABLE_NAME;
```

---

## Part 2: Audit Existing RLS Policies

```sql
-- ============================================================
-- See all RLS policies in your database
-- ============================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- This shows:
-- - policyname: What is this policy called?
-- - permissive: PERMISSIVE (allow) or RESTRICTIVE (deny)?
-- - roles: Which roles does this apply to? (authenticated, anon, specific)
-- - qual: The WHERE condition (what users can READ)
-- - with_check: What users can INSERT/UPDATE/DELETE
```

---

## Part 3: Detailed RLS Policy Checklist for Yard

### Table: `rooms`

**Policy Purpose:** Users can only see/modify rooms they belong to

```sql
-- ✅ Check if policies exist:
SELECT policyname FROM pg_policies 
WHERE tablename = 'rooms' AND schemaname = 'public';

-- Expected policies:
-- - "creator_can_update"
-- - "partner_can_update"
-- - "room_members_can_read"
-- - "room_members_can_delete"
```

**If missing, run:**
```sql
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_members_can_read"
  ON public.rooms
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid() OR partner_id = auth.uid());

CREATE POLICY "creator_can_update"
  ON public.rooms
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "room_members_can_delete"
  ON public.rooms
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid() OR partner_id = auth.uid());

CREATE POLICY "authenticated_can_insert"
  ON public.rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());
```

---

### Table: `chat_messages`

**Policy Purpose:** Users can read messages from rooms they're in; only authors can delete

```sql
-- ✅ Verify policies:
SELECT policyname FROM pg_policies 
WHERE tablename = 'chat_messages' AND schemaname = 'public';

-- Expected policies:
-- - "room_members_can_read_messages"
-- - "author_can_delete_messages"
```

**If missing, run:**
```sql
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_members_can_read_messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT id FROM public.rooms
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_can_insert_messages"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "author_can_delete_messages"
  ON public.chat_messages
  FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());
```

---

### Table: `shared_assets` (Files, Images, Media)

**Policy Purpose:** Users can read assets from their rooms; can delete their own

```sql
-- ✅ Verify policies:
SELECT policyname FROM pg_policies 
WHERE tablename = 'shared_assets' AND schemaname = 'public';

-- Expected policies:
-- - "room_members_can_read_assets"
-- - "owner_can_delete_assets"
```

**If missing, run:**
```sql
ALTER TABLE public.shared_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_members_can_read_assets"
  ON public.shared_assets
  FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT id FROM public.rooms
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_can_upload_assets"
  ON public.shared_assets
  FOR INSERT
  TO authenticated
  WITH CHECK (uploader_id = auth.uid());

CREATE POLICY "owner_can_delete_assets"
  ON public.shared_assets
  FOR DELETE
  TO authenticated
  USING (uploader_id = auth.uid());
```

---

### Table: `user_stats` (Leaderboards, High Scores)

**Policy Purpose:** All authenticated users can read; users can only update their own stats

```sql
-- ✅ Verify policies:
SELECT policyname FROM pg_policies 
WHERE tablename = 'user_stats' AND schemaname = 'public';

-- Expected policies:
-- - "authenticated_can_read_stats"
-- - "user_can_update_own_stats"
```

**If missing, run:**
```sql
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_can_read_stats"
  ON public.user_stats
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "user_can_update_own_stats"
  ON public.user_stats
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No direct INSERT allowed; use trigger/function instead
CREATE POLICY "no_direct_insert_stats"
  ON public.user_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (false);
```

---

### Table: `arcade_sessions` (Game Scores, History)

**Policy Purpose:** Users can read their own sessions; session owner can delete

```sql
-- ✅ Verify policies:
SELECT policyname FROM pg_policies 
WHERE tablename = 'arcade_sessions' AND schemaname = 'public';

-- Expected policies:
-- - "user_can_read_own_sessions"
-- - "user_can_delete_own_sessions"
```

**If missing, run:**
```sql
ALTER TABLE public.arcade_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_can_read_own_sessions"
  ON public.arcade_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_can_insert_own_sessions"
  ON public.arcade_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_can_delete_own_sessions"
  ON public.arcade_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
```

---

### Table: `pair_attempt_log` (Rate Limiting)

**Policy Purpose:** No direct client access; only SECURITY DEFINER functions can insert

```sql
-- ✅ Verify policy:
SELECT policyname FROM pg_policies 
WHERE tablename = 'pair_attempt_log' AND schemaname = 'public';

-- Expected policy:
-- - "no_direct_client_access"

-- This should block all operations
ALTER TABLE public.pair_attempt_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no_client_pair_attempt_log" ON public.pair_attempt_log;
CREATE POLICY "no_client_pair_attempt_log"
  ON public.pair_attempt_log
  FOR ALL
  USING (false);
```

---

## Part 4: Test Your RLS Policies

### Test 1: Verify Isolation Between Rooms

```sql
-- ============================================================
-- As User A, you should only see Room A
-- ============================================================

-- Simulate logged in as user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
SET LOCAL jwt.claims.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT id, creator_id, partner_id FROM public.rooms;
-- Should only show rooms where creator_id or partner_id matches the user
```

### Test 2: Verify Users Can't See Others' Chat

```sql
-- Simulate User B
SET LOCAL jwt.claims.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

SELECT id, room_id, sender_id FROM public.chat_messages;
-- Should only show messages from rooms they're part of
```

### Test 3: Verify Rate Limiting Block

```sql
-- Simulate User C (not connected to rate limit table)
SET LOCAL jwt.claims.sub = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

SELECT * FROM public.pair_attempt_log;
-- Should return: ERROR: new row violates row-level security policy
```

---

## Part 5: Monitor RLS Performance

```sql
-- ============================================================
-- Check if RLS policies are causing performance issues
-- ============================================================

-- View query plans to see if RLS is adding overhead
EXPLAIN ANALYZE
SELECT * FROM public.rooms WHERE creator_id = auth.uid();

-- If you see high planning overhead, consider:
-- 1. Creating indexes on (creator_id, partner_id)
-- 2. Materializing views for read-heavy queries
-- 3. Using SECURITY DEFINER functions for complex policies
```

**Optimization example:**
```sql
-- Create index to speed up RLS filtering
CREATE INDEX IF NOT EXISTS idx_rooms_creator_id 
  ON public.rooms(creator_id);

CREATE INDEX IF NOT EXISTS idx_rooms_partner_id 
  ON public.rooms(partner_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id 
  ON public.chat_messages(room_id);
```

---

## Part 6: Audit Logging (Optional, Advanced)

Track who accessed sensitive data:

```sql
-- Create audit table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  user_id UUID NOT NULL,
  operation TEXT NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
  record_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger to log access
CREATE OR REPLACE FUNCTION public.audit_log_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (table_name, user_id, operation, record_id)
  VALUES (TG_TABLE_NAME, auth.uid(), TG_OP, NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to sensitive tables (optional)
-- CREATE TRIGGER audit_rooms AFTER SELECT ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.audit_log_func();
```

---

## Part 7: Common RLS Mistakes to Avoid

❌ **MISTAKE:** Using ANON role for everything
```sql
-- NEVER do this:
CREATE POLICY "bad_policy"
  ON public.secret_table
  FOR ALL
  TO anon
  USING (true);
```
✅ **FIX:** Require authentication
```sql
CREATE POLICY "good_policy"
  ON public.secret_table
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());
```

---

❌ **MISTAKE:** Using `TRUE` in USING clause
```sql
-- This allows everyone with SELECT permission:
CREATE POLICY "bad_policy"
  ON public.secret_table
  FOR SELECT
  USING (true);
```
✅ **FIX:** Check user identity
```sql
CREATE POLICY "good_policy"
  ON public.secret_table
  FOR SELECT
  USING (owner_id = auth.uid());
```

---

❌ **MISTAKE:** Forgetting WITH CHECK for UPDATE/INSERT
```sql
-- User A could UPDATE rows to set owner_id = User B:
CREATE POLICY "incomplete"
  ON public.messages
  FOR UPDATE
  USING (sender_id = auth.uid());
  -- Missing WITH CHECK!
```
✅ **FIX:** Add WITH CHECK
```sql
CREATE POLICY "complete"
  ON public.messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());
```

---

## Part 8: Quick Reference Commands

```bash
# In Supabase SQL Editor:

# View all RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'public';

# Disable RLS on a table (for testing only!)
ALTER TABLE public.TABLE_NAME DISABLE ROW LEVEL SECURITY;

# Re-enable RLS
ALTER TABLE public.TABLE_NAME ENABLE ROW LEVEL SECURITY;

# Drop a specific policy
DROP POLICY IF EXISTS "policy_name" ON public.table_name;

# View table indexes (for optimization)
SELECT * FROM pg_indexes WHERE tablename = 'your_table';
```

---

## Resources

- [Supabase RLS Guide](https://supabase.io/docs/guides/auth/row-level-security)
- [PostgreSQL Policies](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- [Supabase Dashboard](https://app.supabase.com/)

## Next Steps

1. ✅ Run the SQL queries above to verify your RLS setup
2. ✅ Check that all critical tables have RLS ENABLED
3. ✅ Review policies match the checklist above
4. ✅ Add indexes for performance optimization
5. ✅ Test RLS isolation (Part 4)
6. ✅ Document your RLS architecture

---

**Last Updated:** May 25, 2026  
**Next Review:** August 25, 2026
