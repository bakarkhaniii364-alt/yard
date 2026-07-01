-- ============================================================
-- ATTIC SECURITY HARDENING — Run in Supabase SQL Editor
-- After auth_schema.sql and migration_normalized.sql
-- ============================================================

-- ── Pairing rate limit (brute-force protection) ──
CREATE TABLE IF NOT EXISTS public.pair_attempt_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pair_attempt_log_user_time
  ON public.pair_attempt_log (user_id, created_at DESC);

ALTER TABLE public.pair_attempt_log ENABLE ROW LEVEL SECURITY;

-- No direct client access; only security definer functions write here
DROP POLICY IF EXISTS "no_client_pair_attempt_log" ON public.pair_attempt_log;
CREATE POLICY "no_client_pair_attempt_log" ON public.pair_attempt_log
  FOR ALL USING (false);

CREATE OR REPLACE FUNCTION public.pair_with_code(target_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_row rooms%rowtype;
  attempts_in_window INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated', 'message', 'Please sign in first.');
  END IF;

  SELECT COUNT(*)::INT INTO attempts_in_window
  FROM public.pair_attempt_log
  WHERE user_id = auth.uid()
    AND created_at > NOW() - INTERVAL '15 minutes';

  IF attempts_in_window >= 10 THEN
    RETURN json_build_object(
      'error', 'rate_limited',
      'message', 'Too many pairing attempts. Please wait 15 minutes and try again.'
    );
  END IF;

  INSERT INTO public.pair_attempt_log (user_id) VALUES (auth.uid());

  SELECT * INTO room_row
  FROM rooms
  WHERE invite_code = upper(trim(target_code))
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'error', 'invalid_code',
      'message', 'That code doesn''t exist. Double-check and try again.'
    );
  END IF;

  IF room_row.creator_id = auth.uid() THEN
    RETURN json_build_object(
      'error', 'own_room',
      'message', 'You can''t pair with yourself — share this code with your partner.'
    );
  END IF;

  IF room_row.partner_id IS NOT NULL THEN
    RETURN json_build_object(
      'error', 'already_paired',
      'message', 'This Attic is already full. Ask your partner for a fresh code.'
    );
  END IF;

  DELETE FROM rooms
  WHERE creator_id = auth.uid() AND partner_id IS NULL AND id <> room_row.id;

  UPDATE rooms SET partner_id = auth.uid() WHERE id = room_row.id;

  -- Clear attempts on success
  DELETE FROM public.pair_attempt_log WHERE user_id = auth.uid();

  RETURN json_build_object('success', true, 'room_id', room_row.id);
END;
$$;

-- ── Room-scoped highscores (couple leaderboard only) ──
CREATE TABLE IF NOT EXISTS public.highscores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL DEFAULT 'Player',
  game_id TEXT NOT NULL,
  mode TEXT DEFAULT 'arcade',
  score INTEGER NOT NULL CHECK (score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.highscores
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE;

-- Policies block ALTER TYPE; drop all on highscores before changing columns
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'highscores'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.highscores', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.highscores
  ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

UPDATE public.highscores h
SET room_id = r.id
FROM public.rooms r
WHERE h.room_id IS NULL
  AND (r.creator_id = h.user_id OR r.partner_id = h.user_id)
  AND r.is_active = true;

DELETE FROM public.highscores WHERE room_id IS NULL;

ALTER TABLE public.highscores ALTER COLUMN room_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_highscores_room_score
  ON public.highscores (room_id, game_id, score DESC);

ALTER TABLE public.highscores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "access_room_highscores" ON public.highscores;
CREATE POLICY "access_room_highscores" ON public.highscores
  FOR ALL
  TO authenticated
  USING (
    room_id IN (
      SELECT id FROM public.rooms
      WHERE (creator_id = auth.uid() OR partner_id = auth.uid())
        AND is_active = true
    )
  )
  WITH CHECK (
    room_id IN (
      SELECT id FROM public.rooms
      WHERE (creator_id = auth.uid() OR partner_id = auth.uid())
        AND is_active = true
    )
    AND user_id = auth.uid()
  );
