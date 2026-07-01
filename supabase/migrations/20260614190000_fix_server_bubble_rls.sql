-- Migration: 20260614190000_fix_server_bubble_rls.sql
-- Description: Fixes missing INSERT policies for servers, channels, and members, and fixes bulk insert issue for bubble members.

-- 1. Fix yard_servers missing INSERT/UPDATE/DELETE policies
CREATE POLICY "Users can create servers"
ON public.yard_servers FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update servers"
ON public.yard_servers FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete servers"
ON public.yard_servers FOR DELETE
USING (owner_id = auth.uid());

-- 2. Fix yard_channels missing INSERT/UPDATE/DELETE policies
CREATE POLICY "Users can create channels in their servers"
ON public.yard_channels FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.yard_server_members
    WHERE server_id = yard_channels.server_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update channels in their servers"
ON public.yard_channels FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.yard_server_members
    WHERE server_id = yard_channels.server_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete channels in their servers"
ON public.yard_channels FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.yard_server_members
    WHERE server_id = yard_channels.server_id AND user_id = auth.uid()
  )
);

-- 3. Fix yard_server_members missing INSERT/DELETE policies
CREATE POLICY "Users can add members to their servers"
ON public.yard_server_members FOR INSERT
WITH CHECK (
  -- Joining (adding yourself)
  user_id = auth.uid() OR
  -- Already a member (adding someone else)
  EXISTS (
    SELECT 1 FROM public.yard_server_members m
    WHERE m.server_id = yard_server_members.server_id AND m.user_id = auth.uid()
  ) OR
  -- Server owner
  EXISTS (
    SELECT 1 FROM public.yard_servers s
    WHERE s.id = yard_server_members.server_id AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can leave or owner can remove members"
ON public.yard_server_members FOR DELETE
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.yard_servers s
    WHERE s.id = yard_server_members.server_id AND s.owner_id = auth.uid()
  )
);

-- 4. Fix yard_bubble_members bulk insert issue
-- The original policy failed when doing a bulk insert because the user wasn't in the table yet.
-- We add a condition to allow the owner of the bubble to add members.
DROP POLICY IF EXISTS "Users can add bubble members" ON public.yard_bubble_members;

CREATE POLICY "Users can add bubble members"
ON public.yard_bubble_members FOR INSERT
WITH CHECK (
  -- Either the user is adding themselves
  user_id = auth.uid() OR
  -- Or the user is already a member
  EXISTS (
    SELECT 1 FROM public.yard_bubble_members m
    WHERE m.bubble_id = yard_bubble_members.bubble_id AND m.user_id = auth.uid()
  ) OR
  -- Or the user is the owner of the bubble (fixes the bulk insert on creation)
  EXISTS (
    SELECT 1 FROM public.yard_bubbles b
    WHERE b.id = yard_bubble_members.bubble_id AND b.owner_id = auth.uid()
  )
);
