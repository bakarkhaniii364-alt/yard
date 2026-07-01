-- Migration: 20260611153500_server_guild_dms.sql
-- Description: Sets up proper social features for servers/guilds (categories, invites) and DM communication (channels, members, direct messages)

-- 1. Server Invites (For proper guild invitation flow)
CREATE TABLE public.yard_server_invites (
  code text PRIMARY KEY,
  server_id uuid REFERENCES public.yard_servers(id) ON DELETE CASCADE,
  creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  max_uses integer,
  uses integer DEFAULT 0 NOT NULL,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for server invites
ALTER TABLE public.yard_server_invites ENABLE ROW LEVEL SECURITY;

-- 2. Add channel category and description to channels for proper layout grouping
ALTER TABLE public.yard_channels 
ADD COLUMN IF NOT EXISTS category_name text DEFAULT 'text channels',
ADD COLUMN IF NOT EXISTS description text;

-- 3. DM Channels (DM conversation headers)
CREATE TABLE public.yard_dm_channels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for DM channels
ALTER TABLE public.yard_dm_channels ENABLE ROW LEVEL SECURITY;

-- 4. DM Members (Participants in a direct message channel)
CREATE TABLE public.yard_dm_members (
  channel_id uuid REFERENCES public.yard_dm_channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);

-- Enable RLS for DM members
ALTER TABLE public.yard_dm_members ENABLE ROW LEVEL SECURITY;

-- 5. DM Messages (Individual messages sent in a direct message channel)
CREATE TABLE public.yard_dm_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid REFERENCES public.yard_dm_channels(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  attachment_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for DM messages
ALTER TABLE public.yard_dm_messages ENABLE ROW LEVEL SECURITY;


-- Set up RLS Policies for social tables

-- Invites: Anyone in the server can view invites; anyone can view a specific invite to join it
CREATE POLICY "Users can view invites for their servers" 
ON public.yard_server_invites FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.yard_server_members 
    WHERE server_id = yard_server_invites.server_id AND user_id = auth.uid()
  ) OR expires_at IS NULL OR expires_at > now()
);

CREATE POLICY "Users can create invites for their servers" 
ON public.yard_server_invites FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.yard_server_members 
    WHERE server_id = yard_server_invites.server_id AND user_id = auth.uid()
  )
);

-- DM Channels: A user can see DM channels they belong to
CREATE POLICY "Users can view their DM channels"
ON public.yard_dm_channels FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.yard_dm_members
    WHERE channel_id = yard_dm_channels.id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create DM channels"
ON public.yard_dm_channels FOR INSERT
WITH CHECK (true); -- Anyone can start a DM channel

-- DM Members: Users can see DM participants of channels they belong to
CREATE POLICY "Users can view DM channel participants"
ON public.yard_dm_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.yard_dm_members m
    WHERE m.channel_id = yard_dm_members.channel_id AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join DM channels"
ON public.yard_dm_members FOR INSERT
WITH CHECK (user_id = auth.uid() OR EXISTS (
  -- Allow creator to add other participants when starting a DM
  SELECT 1 FROM public.yard_dm_members m
  WHERE m.channel_id = yard_dm_members.channel_id AND m.user_id = auth.uid()
));

-- DM Messages: Users can see messages in DM channels they are members of
CREATE POLICY "Users can view messages in their DM channels"
ON public.yard_dm_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.yard_dm_members
    WHERE channel_id = yard_dm_messages.channel_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages into their DM channels"
ON public.yard_dm_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.yard_dm_members
    WHERE channel_id = yard_dm_messages.channel_id AND user_id = auth.uid()
  )
);
