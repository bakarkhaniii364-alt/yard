-- Yard Posts Migration
CREATE TABLE IF NOT EXISTS public.yard_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  image_url text,
  background text,
  likes uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.yard_posts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view posts" 
ON public.yard_posts FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own posts" 
ON public.yard_posts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" 
ON public.yard_posts FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" 
ON public.yard_posts FOR DELETE 
USING (auth.uid() = user_id);
