-- Yard Specific Tables

-- 1. Yard Servers (Similar to Discord servers/guilds)
CREATE TABLE public.yard_servers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon_url text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.yard_servers ENABLE ROW LEVEL SECURITY;

-- 2. Yard Channels (Channels within servers)
CREATE TABLE public.yard_channels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id uuid REFERENCES public.yard_servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('text', 'voice')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.yard_channels ENABLE ROW LEVEL SECURITY;

-- 3. Yard Server Members (Who is in what server)
CREATE TABLE public.yard_server_members (
  server_id uuid REFERENCES public.yard_servers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (server_id, user_id)
);

-- Enable RLS
ALTER TABLE public.yard_server_members ENABLE ROW LEVEL SECURITY;

-- 4. Yard Messages
CREATE TABLE public.yard_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid REFERENCES public.yard_channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.yard_messages ENABLE ROW LEVEL SECURITY;

-- Set up basic RLS Policies
-- Servers: Anyone can see servers they are a member of
CREATE POLICY "Users can view servers they belong to" 
ON public.yard_servers FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.yard_server_members 
    WHERE server_id = yard_servers.id AND user_id = auth.uid()
  )
);

-- Server Members: Users can see members of their servers
CREATE POLICY "Users can view members of their servers" 
ON public.yard_server_members FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.yard_server_members sm
    WHERE sm.server_id = yard_server_members.server_id AND sm.user_id = auth.uid()
  )
);

-- Channels: Users can view channels of servers they are in
CREATE POLICY "Users can view channels of their servers" 
ON public.yard_channels FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.yard_server_members 
    WHERE server_id = yard_channels.server_id AND user_id = auth.uid()
  )
);

-- Messages: Users can view messages in channels of servers they are in
CREATE POLICY "Users can view messages of their servers" 
ON public.yard_messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.yard_channels c
    JOIN public.yard_server_members sm ON c.server_id = sm.server_id
    WHERE c.id = yard_messages.channel_id AND sm.user_id = auth.uid()
  )
);

-- Users can insert messages if they are in the server
CREATE POLICY "Users can insert messages" 
ON public.yard_messages FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.yard_channels c
    JOIN public.yard_server_members sm ON c.server_id = sm.server_id
    WHERE c.id = channel_id AND sm.user_id = auth.uid()
  )
);
