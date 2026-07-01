-- Migration: 20260615000000_fix_rls_recursion.sql
-- Description: Replaces self-referencing EXISTS checks with SECURITY DEFINER functions to prevent infinite recursion.

-- 1. Create SECURITY DEFINER functions to bypass RLS for membership checks safely
CREATE OR REPLACE FUNCTION public.is_server_member(server_uuid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.yard_server_members
    WHERE server_id = server_uuid AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_bubble_member(bubble_uuid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.yard_bubble_members
    WHERE bubble_id = bubble_uuid AND user_id = auth.uid()
  );
$$;

-- 2. Update yard_servers policies
DROP POLICY IF EXISTS "Users can view servers they belong to" ON public.yard_servers;
CREATE POLICY "Users can view servers they belong to" 
ON public.yard_servers FOR SELECT 
USING ( public.is_server_member(id) OR owner_id = auth.uid() );

-- 3. Update yard_server_members policies
DROP POLICY IF EXISTS "Users can view members of their servers" ON public.yard_server_members;
CREATE POLICY "Users can view members of their servers" 
ON public.yard_server_members FOR SELECT 
USING ( public.is_server_member(server_id) );

DROP POLICY IF EXISTS "Users can add members to their servers" ON public.yard_server_members;
CREATE POLICY "Users can add members to their servers"
ON public.yard_server_members FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR
  public.is_server_member(server_id) OR
  EXISTS (
    SELECT 1 FROM public.yard_servers s
    WHERE s.id = server_id AND s.owner_id = auth.uid()
  )
);

-- 4. Update yard_channels policies
DROP POLICY IF EXISTS "Users can view channels of their servers" ON public.yard_channels;
CREATE POLICY "Users can view channels of their servers" 
ON public.yard_channels FOR SELECT 
USING ( public.is_server_member(server_id) );

DROP POLICY IF EXISTS "Users can create channels in their servers" ON public.yard_channels;
CREATE POLICY "Users can create channels in their servers"
ON public.yard_channels FOR INSERT
WITH CHECK ( public.is_server_member(server_id) );

DROP POLICY IF EXISTS "Users can update channels in their servers" ON public.yard_channels;
CREATE POLICY "Users can update channels in their servers"
ON public.yard_channels FOR UPDATE
USING ( public.is_server_member(server_id) );

DROP POLICY IF EXISTS "Users can delete channels in their servers" ON public.yard_channels;
CREATE POLICY "Users can delete channels in their servers"
ON public.yard_channels FOR DELETE
USING ( public.is_server_member(server_id) );

-- 5. Update yard_messages policies
DROP POLICY IF EXISTS "Users can view messages of their servers" ON public.yard_messages;
CREATE POLICY "Users can view messages of their servers" 
ON public.yard_messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.yard_channels c
    WHERE c.id = yard_messages.channel_id AND public.is_server_member(c.server_id)
  )
);

DROP POLICY IF EXISTS "Users can insert messages" ON public.yard_messages;
CREATE POLICY "Users can insert messages" 
ON public.yard_messages FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.yard_channels c
    WHERE c.id = channel_id AND public.is_server_member(c.server_id)
  ) AND user_id = auth.uid()
);

-- 6. Update yard_bubbles policies
DROP POLICY IF EXISTS "Users can view their bubbles" ON public.yard_bubbles;
CREATE POLICY "Users can view their bubbles" 
ON public.yard_bubbles FOR SELECT 
USING ( public.is_bubble_member(id) OR owner_id = auth.uid() );

-- 7. Update yard_bubble_members policies
DROP POLICY IF EXISTS "Users can view bubble members" ON public.yard_bubble_members;
CREATE POLICY "Users can view bubble members" 
ON public.yard_bubble_members FOR SELECT 
USING ( public.is_bubble_member(bubble_id) );

DROP POLICY IF EXISTS "Users can add bubble members" ON public.yard_bubble_members;
CREATE POLICY "Users can add bubble members"
ON public.yard_bubble_members FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR
  public.is_bubble_member(bubble_id) OR
  EXISTS (
    SELECT 1 FROM public.yard_bubbles b
    WHERE b.id = bubble_id AND b.owner_id = auth.uid()
  )
);

-- 8. Update yard_bubble_messages policies
DROP POLICY IF EXISTS "Users can view bubble messages" ON public.yard_bubble_messages;
CREATE POLICY "Users can view bubble messages" 
ON public.yard_bubble_messages FOR SELECT 
USING ( public.is_bubble_member(bubble_id) );

DROP POLICY IF EXISTS "Users can insert bubble messages" ON public.yard_bubble_messages;
CREATE POLICY "Users can insert bubble messages" 
ON public.yard_bubble_messages FOR INSERT 
WITH CHECK (
  sender_id = auth.uid() AND
  public.is_bubble_member(bubble_id)
);
