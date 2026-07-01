-- ============================================================
-- ATTIC STORAGE RLS — Run this in Supabase SQL Editor
-- ============================================================
-- Private media buckets: doodles, scrapbook, voice_notes
-- Upload path (app): {roomId}/{timestamp}_{random}.{ext}
--
-- Ensures users can only read/write/delete objects in folders
-- matching an active room they belong to. Blocks cross-room
-- scraping even if someone guesses another room's UUID path.
-- ============================================================

-- Buckets must exist (private) in Dashboard > Storage:
--   doodles, scrapbook, voice_notes

-- Helper: true when the authenticated user may access this object path
CREATE OR REPLACE FUNCTION public.user_can_access_storage_object(bucket text, object_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    bucket IN ('doodles', 'scrapbook', 'voice_notes')
    AND (storage.foldername(object_path))[1]::uuid IN (
      SELECT id
      FROM public.rooms
      WHERE (creator_id = auth.uid() OR partner_id = auth.uid())
        AND is_active = true
    );
$$;

-- RLS is enabled by default on storage.objects in Supabase projects.
-- Replace any prior Attic storage policies if re-running this script.

DROP POLICY IF EXISTS "access_room_storage" ON storage.objects;

CREATE POLICY "access_room_storage"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (public.user_can_access_storage_object(bucket_id, name))
  WITH CHECK (public.user_can_access_storage_object(bucket_id, name));
