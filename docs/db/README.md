# Yard database setup

> **Do not paste this file into the Supabase SQL Editor.**  
> It is Markdown documentation only. PostgreSQL will error on `#` lines.  
> Open and run each **`.sql`** file below, one at a time.

## Run in order (Supabase → SQL Editor → New query)

| Step | File | What it does |
|------|------|----------------|
| 1 | [`supabase/migrations/01_init.sql`](../../supabase/migrations/01_init.sql) | `app_state` + realtime |
| 2 | [`supabase/migrations/02_auth_schema.sql`](../../supabase/migrations/02_auth_schema.sql) | Rooms, pairing RPCs, signup trigger |
| 3 | [`supabase/migrations/03_migration_normalized.sql`](../../supabase/migrations/03_migration_normalized.sql) | Chat, assets, arcade tables |
| 4 | [`supabase/migrations/05_storage_policies.sql`](../../supabase/migrations/05_storage_policies.sql) | Private bucket RLS |
| 5 | [`supabase/migrations/04_security_hardening.sql`](../../supabase/migrations/04_security_hardening.sql) | Pairing rate limits + `highscores` RLS |

## Before step 4

In **Storage**, create three **private** buckets: `doodles`, `scrapbook`, `voice_notes`.

## Already set up?

If steps 1–3 ran earlier, you only need **`storage_policies.sql`** and **`security_hardening.sql`**.
