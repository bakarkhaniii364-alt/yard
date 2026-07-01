-- Migration: 20260611160000_add_comment_parent_id.sql
-- Description: Adds a parent_id column to yard_post_comments to support nested replies

ALTER TABLE public.yard_post_comments 
ADD COLUMN IF NOT EXISTS parent_id text;
