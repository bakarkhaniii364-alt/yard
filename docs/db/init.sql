-- Run this script exactly once in the Supabase SQL Editor
create table if not exists app_state (
  room_id uuid primary key,
  state jsonb default '{}'::jsonb,
  last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- Enable realtime broadcasts for the table
alter publication supabase_realtime add table app_state;
