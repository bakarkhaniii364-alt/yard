-- Migration: Seed default hangout server and handle automatic membership
-- ID for hangout server: da2a11b0-ab12-4c34-8f56-7890abcdef12
-- Channel IDs:
-- announcements: da2a11b0-ab12-4c34-8f56-7890abcdef11
-- general: da2a11b0-ab12-4c34-8f56-7890abcdef22
-- random: da2a11b0-ab12-4c34-8f56-7890abcdef33
-- voice-1: da2a11b0-ab12-4c34-8f56-7890abcdef77

-- 1. Insert default hangout server
INSERT INTO public.yard_servers (id, name, description, icon_url, owner_id)
VALUES ('da2a11b0-ab12-4c34-8f56-7890abcdef12'::uuid, 'hangout', 'hangout and chat in our main yard', '🌳', NULL)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, icon_url = EXCLUDED.icon_url;

-- 2. Insert channels for the hangout server
INSERT INTO public.yard_channels (id, server_id, name, type, category_name, description)
VALUES 
  ('da2a11b0-ab12-4c34-8f56-7890abcdef11'::uuid, 'da2a11b0-ab12-4c34-8f56-7890abcdef12'::uuid, 'announcements', 'text', 'General', 'Important updates for everyone'),
  ('da2a11b0-ab12-4c34-8f56-7890abcdef22'::uuid, 'da2a11b0-ab12-4c34-8f56-7890abcdef12'::uuid, 'general', 'text', 'General', 'The main yard gathering place'),
  ('da2a11b0-ab12-4c34-8f56-7890abcdef33'::uuid, 'da2a11b0-ab12-4c34-8f56-7890abcdef12'::uuid, 'random', 'text', 'General', 'Anything goes here'),
  ('da2a11b0-ab12-4c34-8f56-7890abcdef77'::uuid, 'da2a11b0-ab12-4c34-8f56-7890abcdef12'::uuid, 'Voice 1', 'voice', 'General', NULL)
ON CONFLICT (id) DO NOTHING;

-- 3. Create or replace function to join hangout server on signup
CREATE OR REPLACE FUNCTION public.join_hangout_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.yard_server_members (server_id, user_id, role)
  VALUES ('da2a11b0-ab12-4c34-8f56-7890abcdef12'::uuid, NEW.id, 'member')
  ON CONFLICT (server_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4. Create trigger on auth.users table
DROP TRIGGER IF EXISTS tr_join_hangout_on_signup ON auth.users;
CREATE TRIGGER tr_join_hangout_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.join_hangout_on_signup();

-- 5. Backfill existing users in auth.users to hangout server
INSERT INTO public.yard_server_members (server_id, user_id, role)
SELECT 'da2a11b0-ab12-4c34-8f56-7890abcdef12'::uuid, id, 'member'
FROM auth.users
ON CONFLICT (server_id, user_id) DO NOTHING;
