# Database Migration Execution Guide

## Overview
This guide walks you through executing the database migrations to fix the type-mismatch errors (`operator does not exist: text = uuid`) and register the missing `merge_app_state` RPC function.

## Issues Fixed

### 1. **Schema Inconsistency** (Type Mismatch)
- **Problem**: `app_state.room_id` was defined as `TEXT` in `init.sql`, but functions expected `UUID`
- **Error**: `operator does not exist: text = uuid`
- **Fix**: Changed `app_state.room_id` to `UUID` to match the `rooms` table schema

### 2. **Function Parameter Type Bug**
- **Problem**: `update_app_state_atomic` accepted `text` for `p_room_id` but was casting to `uuid` with an incorrect WHERE clause
- **Error**: Type comparison mismatch when Postgres tried to execute the UPDATE
- **Fix**: 
  - Changed parameter `p_room_id` from `text` to `uuid`
  - Fixed WHERE clause from `WHERE room_id::text = p_room_id` → `WHERE room_id = p_room_id`
  - Fixed INSERT from `VALUES (p_room_id::uuid, ...)` → `VALUES (p_room_id, ...)`

### 3. **Missing Function Registration**
- **Problem**: Frontend calls `supabase.rpc('merge_app_state', ...)` but the function doesn't exist in production
- **Error**: 404 (Not Found)
- **Fix**: Ensure `merge_app_state` function is created via migrations

---

## Step-by-Step Execution

### **IMPORTANT: Backup First!**
Before running any migrations, create a Supabase backup:
1. Go to your Supabase Dashboard
2. Navigate to **Settings → Backups**
3. Click **Create a new backup** and wait for completion

---

### **Step 1: Run init.sql** (If you haven't already or need to reset)

1. Open your **Supabase Dashboard** → **SQL Editor**
2. Create a new query and copy-paste the entire contents of:
   ```
   docs/db/init.sql
   ```
3. **Note**: If `app_state` table already exists, you can either:
   - **Option A**: Drop and recreate (loses data)
     ```sql
     DROP TABLE IF EXISTS app_state CASCADE;
     ```
     Then run the full `init.sql`
   
   - **Option B**: Alter the existing table's column type
     ```sql
     ALTER TABLE app_state ALTER COLUMN room_id TYPE uuid USING room_id::uuid;
     ```
     Then continue with Step 2.

4. Click **Run** and verify success

---

### **Step 2: Run migration_normalized.sql**

1. In the same **SQL Editor**, create a **new query**
2. Copy-paste the entire contents of:
   ```
   docs/db/migration_normalized.sql
   ```
3. Click **Run** and wait for completion
4. Check for errors in the output panel

**Expected Results**:
- All tables created successfully
- All RLS policies applied
- All functions registered (including `merge_app_state`)
- All indices created

---

### **Step 3: Verify Functions Were Created**

Run this verification query in the SQL Editor:

```sql
SELECT 
  routines.routine_name,
  parameters.parameter_name,
  parameters.data_type
FROM information_schema.routines
LEFT JOIN information_schema.parameters ON routines.specific_name = parameters.specific_name
WHERE routine_schema = 'public'
  AND routine_name IN ('merge_app_state', 'update_app_state_atomic', 'join_arcade_session', 'set_arcade_ready', 'leave_arcade_session')
ORDER BY routine_name, parameters.ordinal_position;
```

You should see:
- `merge_app_state(p_room_id uuid, p_key text, p_value jsonb)`
- `update_app_state_atomic(p_room_id uuid, p_key text, p_subkey text, p_value jsonb)`
- Other arcade functions with `UUID` parameters

---

### **Step 4: Verify app_state Table Schema**

Run this query:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'app_state';
```

Expected output:
```
 column_name   | data_type
---------------+------------------------
 room_id       | uuid
 state         | jsonb
 last_updated  | timestamp with time zone
```

If `room_id` still shows as `text`, run:
```sql
ALTER TABLE app_state ALTER COLUMN room_id TYPE uuid USING room_id::uuid;
```

---

### **Step 5: Test the RPC Function**

Run this test in the SQL Editor:

```sql
SELECT merge_app_state(
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'test_key',
  '{"test": "value"}'::jsonb
);
```

Expected: Query executes without error

---

## Deployment Checklist

- [ ] Database backup created
- [ ] `init.sql` executed successfully
- [ ] `migration_normalized.sql` executed successfully
- [ ] Functions verified in information_schema
- [ ] `app_state` table schema shows `room_id` as `uuid`
- [ ] RPC test query succeeds
- [ ] Frontend app deployed and tested
- [ ] No more 404 or type-mismatch errors in console

---

## Troubleshooting

### Error: "relation 'app_state' already exists"
**Solution**: This is fine; the CREATE IF NOT EXISTS clause will skip it. Continue.

### Error: "function merge_app_state already exists"
**Solution**: The DROP FUNCTION statements should handle this. If not, manually drop:
```sql
DROP FUNCTION IF EXISTS merge_app_state CASCADE;
```

### Error: "operator does not exist: text = uuid"
**Cause**: You're still using the old function signatures.
**Solution**: Ensure you've run the updated `migration_normalized.sql` with the fixed `update_app_state_atomic` function.

### Frontend still shows 404 on merge_app_state
**Solutions**:
1. Verify function exists: run the verification query from Step 3
2. Check Supabase client initialization in your code (`lib/supabase.js`)
3. Ensure you've restarted your dev server or deployed the updated migration
4. Check browser console for exact error message

---

## Modified Files

The following files have been updated:
- `docs/db/init.sql` - Changed `app_state.room_id` from `text` to `uuid`
- `docs/db/migration_normalized.sql` - Fixed `update_app_state_atomic` function signature and WHERE clause

No changes needed to frontend code—it should work once migrations are applied.
