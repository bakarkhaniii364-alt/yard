-- Yard Comments Migration
CREATE TABLE IF NOT EXISTS public.yard_post_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id text NOT NULL, -- UUID string or bot/state post ID
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  emoji text,
  avatar text,
  content text NOT NULL,
  likes uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  dislikes uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.yard_post_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view comments" 
ON public.yard_post_comments FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert comments" 
ON public.yard_post_comments FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own comments" 
ON public.yard_post_comments FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
ON public.yard_post_comments FOR DELETE 
USING (auth.uid() = user_id);
