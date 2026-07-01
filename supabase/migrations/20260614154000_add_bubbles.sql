-- Migration: 20260614154000_add_bubbles.sql
-- Description: Adds tables and RLS policies for group chats ("bubbles")

-- 1. Bubbles (Group chats metadata)
CREATE TABLE public.yard_bubbles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon_url text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.yard_bubbles ENABLE ROW LEVEL SECURITY;

-- 2. Bubble Members (Who belongs to which group chat)
CREATE TABLE public.yard_bubble_members (
  bubble_id uuid REFERENCES public.yard_bubbles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (bubble_id, user_id)
);

-- Enable RLS
ALTER TABLE public.yard_bubble_members ENABLE ROW LEVEL SECURITY;

-- 3. Bubble Messages (Messages sent in a group chat)
CREATE TABLE public.yard_bubble_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bubble_id uuid REFERENCES public.yard_bubbles(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  attachment_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.yard_bubble_messages ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies

-- Bubbles: Users can view bubbles they belong to
CREATE POLICY "Users can view their bubbles" 
ON public.yard_bubbles FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.yard_bubble_members 
    WHERE bubble_id = yard_bubbles.id AND user_id = auth.uid()
  )
);

-- Bubbles: Authenticated users can create bubbles
CREATE POLICY "Users can create bubbles" 
ON public.yard_bubbles FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Bubbles: Owners can update their bubbles
CREATE POLICY "Owners can update their bubbles" 
ON public.yard_bubbles FOR UPDATE 
USING (
  owner_id = auth.uid()
);

-- Bubbles: Owners can delete their bubbles
CREATE POLICY "Owners can delete their bubbles" 
ON public.yard_bubbles FOR DELETE 
USING (
  owner_id = auth.uid()
);

-- Bubble Members: Users can view members of bubbles they belong to
CREATE POLICY "Users can view bubble members" 
ON public.yard_bubble_members FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.yard_bubble_members m
    WHERE m.bubble_id = yard_bubble_members.bubble_id AND m.user_id = auth.uid()
  )
);

-- Bubble Members: Users can join or be added to bubbles
CREATE POLICY "Users can add bubble members" 
ON public.yard_bubble_members FOR INSERT 
WITH CHECK (
  -- Either the user is adding themselves, or the user is already a member of the bubble adding someone else
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.yard_bubble_members m
    WHERE m.bubble_id = yard_bubble_members.bubble_id AND m.user_id = auth.uid()
  )
);

-- Bubble Members: Users can leave or be kicked from bubbles
CREATE POLICY "Users can remove bubble members" 
ON public.yard_bubble_members FOR DELETE 
USING (
  -- Either the user is leaving (removing themselves) or they are the owner of the bubble
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.yard_bubbles b
    WHERE b.id = yard_bubble_members.bubble_id AND b.owner_id = auth.uid()
  )
);

-- Bubble Messages: Users can view messages in bubbles they are members of
CREATE POLICY "Users can view bubble messages" 
ON public.yard_bubble_messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.yard_bubble_members
    WHERE bubble_id = yard_bubble_messages.bubble_id AND user_id = auth.uid()
  )
);

-- Bubble Messages: Users can insert messages in bubbles they belong to
CREATE POLICY "Users can insert bubble messages" 
ON public.yard_bubble_messages FOR INSERT 
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.yard_bubble_members
    WHERE bubble_id = yard_bubble_messages.bubble_id AND user_id = auth.uid()
  )
);

-- Bubble Messages: Users can delete/update their own messages
CREATE POLICY "Users can update/delete their own bubble messages" 
ON public.yard_bubble_messages FOR ALL 
USING (
  sender_id = auth.uid()
);
