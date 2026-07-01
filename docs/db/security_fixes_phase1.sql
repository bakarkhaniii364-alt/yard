-- ============================================================
-- Phase 1 Security Fixes
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Helper function to check if the current user owns the room
CREATE OR REPLACE FUNCTION public.user_owns_room(p_room_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = p_room_id
      AND is_active = true
      AND (creator_id = auth.uid() OR partner_id = auth.uid())
  );
$$;

-- 2. Harden merge_app_state
CREATE OR REPLACE FUNCTION merge_app_state(p_room_id uuid, p_key text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT user_owns_room(p_room_id) THEN
    RAISE EXCEPTION 'room access denied' USING ERRCODE = '42501';
  END IF;
  IF p_key !~ '^[a-z_0-9]{1,50}$' OR p_key NOT IN (
    'room_profiles','couple_data','arcade_lobby',
    'game_scores','user_streaks'
  ) THEN
    RAISE EXCEPTION 'invalid key' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE app_state
  SET state = jsonb_set(
    COALESCE(state, '{}'::jsonb),
    ARRAY[p_key],
    COALESCE(state->p_key, '{}'::jsonb) || p_value,
    true
  )
  WHERE room_id = p_room_id;
END;
$$;

-- 3. Harden update_app_state_atomic
CREATE OR REPLACE FUNCTION update_app_state_atomic(p_room_id uuid, p_key text, p_subkey text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT user_owns_room(p_room_id) THEN
    RAISE EXCEPTION 'room access denied' USING ERRCODE = '42501';
  END IF;
  IF p_key !~ '^[a-z_0-9]{1,50}$' OR p_key NOT IN (
    'room_profiles','couple_data','arcade_lobby',
    'game_scores','user_streaks'
  ) THEN
    RAISE EXCEPTION 'invalid key' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Ensure row exists
  INSERT INTO app_state (room_id, state)
  VALUES (p_room_id, '{}'::jsonb)
  ON CONFLICT (room_id) DO NOTHING;

  -- Atomic update
  UPDATE app_state
  SET state = jsonb_set(
    COALESCE(state, '{}'::jsonb),
    ARRAY[p_key, p_subkey],
    CASE 
      WHEN jsonb_typeof(COALESCE(state->p_key->p_subkey, 'null'::jsonb)) = 'object' 
           AND jsonb_typeof(p_value) = 'object'
      THEN (COALESCE(state->p_key->p_subkey, '{}'::jsonb) || p_value)
      ELSE p_value
    END,
    true
  )
  WHERE room_id = p_room_id;
END;
$$;

-- 4. Harden arcade functions
CREATE OR REPLACE FUNCTION join_arcade_session(p_room_id UUID, p_game_id TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session arcade_sessions%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
    END IF;
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'invalid user' USING ERRCODE = '28000';
    END IF;
    IF NOT user_owns_room(p_room_id) THEN
        RAISE EXCEPTION 'room access denied' USING ERRCODE = '42501';
    END IF;

    INSERT INTO arcade_sessions (room_id, game_id, player_a_id)
    VALUES (p_room_id, p_game_id, p_user_id)
    ON CONFLICT (room_id, game_id) DO UPDATE
    SET 
        player_a_id = CASE WHEN arcade_sessions.player_a_id IS NULL THEN p_user_id ELSE arcade_sessions.player_a_id END,
        player_b_id = CASE WHEN arcade_sessions.player_a_id IS NOT NULL AND arcade_sessions.player_a_id != p_user_id THEN p_user_id ELSE arcade_sessions.player_b_id END,
        player_a_ready = CASE WHEN arcade_sessions.player_a_id = p_user_id THEN false ELSE arcade_sessions.player_a_ready END,
        player_b_ready = CASE WHEN arcade_sessions.player_b_id = p_user_id THEN false ELSE arcade_sessions.player_b_ready END,
        status = CASE WHEN arcade_sessions.status IN ('playing', 'ended') THEN 'waiting' ELSE arcade_sessions.status END,
        updated_at = now()
    RETURNING * INTO v_session;

    RETURN to_jsonb(v_session);
END;
$$;

CREATE OR REPLACE FUNCTION set_arcade_ready(p_room_id UUID, p_game_id TEXT, p_user_id UUID, p_ready BOOLEAN, p_partner_online BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session arcade_sessions%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
    END IF;
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'invalid user' USING ERRCODE = '28000';
    END IF;
    IF NOT user_owns_room(p_room_id) THEN
        RAISE EXCEPTION 'room access denied' USING ERRCODE = '42501';
    END IF;

    UPDATE arcade_sessions
    SET 
        player_a_ready = CASE WHEN player_a_id = p_user_id THEN p_ready ELSE player_a_ready END,
        player_b_ready = CASE WHEN player_b_id = p_user_id THEN p_ready ELSE player_b_ready END,
        status = CASE 
            WHEN NOT p_partner_online AND p_ready THEN 'starting' -- Solo bypass
            WHEN (player_a_id = p_user_id AND p_ready AND (player_b_ready OR player_b_id IS NULL)) OR 
                 (player_b_id = p_user_id AND p_ready AND (player_a_ready OR player_a_id IS NULL)) 
            THEN 'starting' -- Transition to starting first for countdown
            ELSE status 
        END,
        updated_at = now()
    WHERE room_id = p_room_id AND game_id = p_game_id
    RETURNING * INTO v_session;

    RETURN to_jsonb(v_session);
END;
$$;

CREATE OR REPLACE FUNCTION leave_arcade_session(p_room_id UUID, p_game_id TEXT, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
    END IF;
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'invalid user' USING ERRCODE = '28000';
    END IF;
    IF NOT user_owns_room(p_room_id) THEN
        RAISE EXCEPTION 'room access denied' USING ERRCODE = '42501';
    END IF;

    UPDATE arcade_sessions
    SET 
        player_a_id = CASE WHEN player_a_id = p_user_id THEN NULL ELSE player_a_id END,
        player_b_id = CASE WHEN player_b_id = p_user_id THEN NULL ELSE player_b_id END,
        player_a_ready = CASE WHEN player_a_id = p_user_id THEN false ELSE player_a_ready END,
        player_b_ready = CASE WHEN player_b_id = p_user_id THEN false ELSE player_b_ready END,
        status = CASE WHEN status = 'playing' THEN 'waiting' ELSE status END,
        updated_at = now()
    WHERE room_id = p_room_id AND game_id = p_game_id;

    -- Delete session if both players are gone
    DELETE FROM arcade_sessions
    WHERE room_id = p_room_id AND game_id = p_game_id
    AND player_a_id IS NULL AND player_b_id IS NULL;
END;
$$;

-- 5. Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT,
  old_data JSONB,
  new_data JSONB,
  error_message TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_client_access" ON public.audit_log
  FOR ALL USING (false);
