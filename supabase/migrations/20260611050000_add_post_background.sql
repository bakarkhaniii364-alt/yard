-- Add background column to yard_posts
ALTER TABLE public.yard_posts ADD COLUMN IF NOT EXISTS background text;
