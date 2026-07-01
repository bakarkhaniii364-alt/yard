-- Migration: 20260615020000_add_message_delete_policies.sql
-- Description: Adds DELETE policies for yard_messages and yard_dm_messages so senders can delete/undo their messages

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.yard_messages;
CREATE POLICY "Users can delete their own messages" 
ON public.yard_messages FOR DELETE 
USING ( user_id = auth.uid() );

DROP POLICY IF EXISTS "Users can delete their own DM messages" ON public.yard_dm_messages;
CREATE POLICY "Users can delete their own DM messages" 
ON public.yard_dm_messages FOR DELETE 
USING ( sender_id = auth.uid() );
