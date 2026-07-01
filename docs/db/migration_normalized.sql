-- ============================================================
-- MIGRATION: Database Normalization (Phase 1)
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT DEFAULT 'text', -- 'text', 'voice', 'image', 'system'
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- For reactions, replies, group info
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create shared_assets table (Doodles, Scrapbook Images)
CREATE TABLE IF NOT EXISTS shared_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'image', -- 'doodle', 'scrapbook', 'background'
    url TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- For labels, dimensions, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_assets ENABLE ROW LEVEL SECURITY;

-- 4. Create B-Tree Indices for performance (As per Pro-Tip #1)
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_assets_room_id ON shared_assets(room_id);

-- 5. RLS Policies
-- Users can only access data belonging to their room
DROP POLICY IF EXISTS "access_room_chat" ON chat_messages;
CREATE POLICY "access_room_chat" ON chat_messages
    FOR ALL USING (
        room_id IN (
            SELECT id FROM rooms 
            WHERE (creator_id = auth.uid() OR partner_id = auth.uid()) AND is_active = true
        )
    );

DROP POLICY IF EXISTS "access_room_assets" ON shared_assets;
CREATE POLICY "access_room_assets" ON shared_assets
    FOR ALL USING (
        room_id IN (
            SELECT id FROM rooms 
            WHERE (creator_id = auth.uid() OR partner_id = auth.uid()) AND is_active = true
        )
    );

-- 6. Add to Realtime Publication (As per Pro-Tip #4)
-- Note: If you get an error here saying it's already a member, it's safe to ignore.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'shared_assets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE shared_assets;
    END IF;
END $$;

-- ============================================================
-- NOTE: SUPABASE STORAGE BUCKETS
-- You must manually create the following buckets in the dashboard:
-- 1. 'doodles' (Public: false)
-- 2. 'scrapbook' (Public: false)
-- 3. 'voice_notes' (Public: false)
--
-- Then run docs/db/storage_policies.sql for room-scoped RLS on objects.
-- Then run docs/db/security_hardening.sql (pairing rate limits, highscores RLS).
-- ============================================================

-- ============================================================
-- PRIVACY & COMPLIANCE: Right to be Forgotten
-- ============================================================

CREATE OR REPLACE FUNCTION delete_my_room()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  -- Find the room the user belongs to
  SELECT * INTO r FROM public.rooms 
  WHERE (creator_id = auth.uid() OR partner_id = auth.uid()) AND is_active = true
  LIMIT 1;

  IF r.id IS NOT NULL THEN
    IF r.partner_id IS NOT NULL THEN
      -- Paired room: unpair instead of deleting
      IF r.creator_id = auth.uid() THEN
        UPDATE public.rooms SET creator_id = r.partner_id, partner_id = NULL WHERE id = r.id;
      ELSE
        UPDATE public.rooms SET partner_id = NULL WHERE id = r.id;
      END IF;
    ELSE
      -- Solo room: hard delete
      DELETE FROM public.rooms WHERE id = r.id;
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- MIGRATION: Database Normalization (Phase 2)
-- Adding specialized tables for stats and metadata
-- ============================================================

-- 1. Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    streaks JSONB DEFAULT '{"count": 0, "lastActiveDate": null}'::jsonb,
    game_scores JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create room_metadata table
CREATE TABLE IF NOT EXISTS room_metadata (
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE PRIMARY KEY,
    anniversary TIMESTAMPTZ,
    pet_data JSONB DEFAULT '{"name": "pet", "skin": "/assets/cat_1_9", "happy": 60}'::jsonb,
    nicknames JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{"bgPattern": "grid"}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_metadata ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "access_my_stats" ON user_stats;
CREATE POLICY "access_my_stats" ON user_stats
    FOR ALL USING (
        user_id = auth.uid() OR 
        room_id IN (
            SELECT id FROM rooms 
            WHERE (creator_id = auth.uid() OR partner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "access_room_metadata" ON room_metadata;
CREATE POLICY "access_room_metadata" ON room_metadata
    FOR ALL USING (
        room_id IN (
            SELECT id FROM rooms 
            WHERE (creator_id = auth.uid() OR partner_id = auth.uid())
        )
    );

-- 5. Add to Realtime Publication
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'user_stats'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE user_stats;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'room_metadata'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE room_metadata;
    END IF;
END $$;

-- ============================================================
-- RPC: ATOMIC ARCADE LOBBY JOIN
-- ============================================================

CREATE OR REPLACE FUNCTION join_arcade_lobby(p_room_id UUID, p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE rooms
  SET app_state = jsonb_set(
    COALESCE(app_state, '{}'::jsonb),
    '{arcade_lobby,players}',
    (
      SELECT jsonb_agg(DISTINCT x)
      FROM (
        SELECT jsonb_array_elements_text(COALESCE(app_state->'arcade_lobby'->'players', '[]'::jsonb)) AS x
        UNION
        SELECT p_user_id
      ) AS t
    )
  )
  WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: ATOMIC JSONB STATE UPDATES (Prevents Race Conditions)
-- ============================================================

-- Clear old versions to prevent overloading conflicts
DROP FUNCTION IF EXISTS update_app_state_atomic(text, text, text, jsonb);
DROP FUNCTION IF EXISTS update_app_state_atomic(uuid, text, text, jsonb);

-- Safely updates a nested subkey (e.g., room_profiles -> user_id)
CREATE OR REPLACE FUNCTION update_app_state_atomic(p_room_id uuid, p_key text, p_subkey text, p_value jsonb)
RETURNS void AS $$
BEGIN
  -- 1. Ensure row exists (UPSERT)
  INSERT INTO app_state (room_id, state)
  VALUES (p_room_id, '{}'::jsonb)
  ON CONFLICT (room_id) DO NOTHING;

  -- 2. Atomic update with smart merge
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear old versions
DROP FUNCTION IF EXISTS merge_app_state(text, text, jsonb);
DROP FUNCTION IF EXISTS merge_app_state(uuid, text, jsonb);

-- Safely merges data into a top-level key (e.g., couple_data)
CREATE OR REPLACE FUNCTION merge_app_state(p_room_id uuid, p_key text, p_value jsonb)
RETURNS void AS $$
BEGIN
  UPDATE app_state
  SET state = jsonb_set(
    COALESCE(state, '{}'::jsonb),
    ARRAY[p_key],
    COALESCE(state->p_key, '{}'::jsonb) || p_value,
    true
  )
  WHERE room_id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ARCADE SESSION STATE MACHINE
-- ============================================================

CREATE TABLE IF NOT EXISTS arcade_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL,
    player_a_id UUID REFERENCES auth.users(id),
    player_b_id UUID REFERENCES auth.users(id),
    player_a_ready BOOLEAN DEFAULT false,
    player_b_ready BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'waiting', -- 'waiting', 'playing', 'ended'
    game_state JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(room_id, game_id)
);

ALTER TABLE arcade_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view sessions in their room" ON arcade_sessions;
CREATE POLICY "Users can view sessions in their room" 
    ON arcade_sessions FOR SELECT 
    USING (room_id IN (SELECT id FROM rooms WHERE (creator_id = auth.uid() OR partner_id = auth.uid())));

DROP POLICY IF EXISTS "Users can update sessions in their room" ON arcade_sessions;
CREATE POLICY "Users can update sessions in their room" 
    ON arcade_sessions FOR UPDATE 
    USING (room_id IN (SELECT id FROM rooms WHERE (creator_id = auth.uid() OR partner_id = auth.uid())));

DROP POLICY IF EXISTS "Users can insert sessions in their room" ON arcade_sessions;
CREATE POLICY "Users can insert sessions in their room" 
    ON arcade_sessions FOR INSERT 
    WITH CHECK (room_id IN (SELECT id FROM rooms WHERE (creator_id = auth.uid() OR partner_id = auth.uid())));


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'arcade_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE arcade_sessions;
    END IF;
END $$;

-- ============================================================
-- ARCADE SESSION STATE TRANSITIONS
-- ============================================================

CREATE OR REPLACE FUNCTION join_arcade_session(p_room_id UUID, p_game_id TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session arcade_sessions%ROWTYPE;
BEGIN
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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session arcade_sessions%ROWTYPE;
BEGIN
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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

-- ============================================================
-- ISOLATED ROOM GAME STATS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_player_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    game_name TEXT NOT NULL,
    wins INTEGER DEFAULT 0,
    high_score INTEGER DEFAULT 0,
    UNIQUE(room_id, user_id, game_name)
);

ALTER TABLE room_player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access own room stats" ON room_player_stats;
CREATE POLICY "Access own room stats" ON room_player_stats FOR ALL USING (
    room_id IN (SELECT id FROM rooms WHERE creator_id = auth.uid() OR partner_id = auth.uid())
);

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'room_player_stats'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE room_player_stats;
    END IF;
END $$;

-- ============================================================
-- PERSISTENT GAME STATE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.game_state (
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    game TEXT NOT NULL,
    fen TEXT,
    turn TEXT,
    history JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (room_id, game)
);

ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_members_only" ON public.game_state;
CREATE POLICY "room_members_only" ON public.game_state
    FOR ALL TO authenticated
    USING (room_id IN (
      SELECT id FROM public.rooms
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    ));

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'game_state'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
    END IF;
END $$;