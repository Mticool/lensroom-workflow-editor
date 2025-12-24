# Supabase Setup Guide

Complete guide for setting up Supabase integration for LensRoom Workflow Editor.

---

## Prerequisites

1. **Supabase Project**: Create a project at [supabase.com](https://supabase.com)
2. **Environment Variables**: Get your project credentials from Supabase Dashboard

---

## Step 1: Get Supabase Credentials

### From Supabase Dashboard:

1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️

### Add to `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Kie.ai (for real inference)
KIE_API_KEY=your_kie_api_key

# Mock mode (optional, for development without Kie.ai)
USE_MOCK_INFERENCE=false
```

⚠️ **IMPORTANT**: `SUPABASE_SERVICE_ROLE_KEY` is a server-side secret. Never expose it to the client!

---

## Step 2: Run Database Migration

### Option A: Supabase SQL Editor (Recommended)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase/migrations/0001_credits_generations.sql`
4. Paste into the editor
5. Click **Run** (or press Cmd/Ctrl + Enter)

**Expected result**: ✓ Success. No rows returned

### Option B: Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
brew install supabase/tap/supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

---

## Step 3: Verify Database Setup

Run the following queries in **SQL Editor** to verify:

### Check Tables

```sql
-- Should return: credits, credit_transactions, generations
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('credits', 'credit_transactions', 'generations');
```

### Check RPC Functions

```sql
-- Should return: adjust_credits, get_user_balance
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('adjust_credits', 'get_user_balance');
```

### Check Storage Bucket

```sql
-- Should return: 1 row with id='generations'
SELECT * FROM storage.buckets WHERE id = 'generations';
```

---

## Step 4: Create Test User & Add Credits

### Get Your User ID

Go to **Authentication** → **Users** → Select your user → Copy **UID**

### Add Credits

```sql
-- Replace YOUR_USER_ID with actual UUID
INSERT INTO public.credits (user_id, amount)
VALUES ('YOUR_USER_ID', 100)
ON CONFLICT (user_id) 
DO UPDATE SET amount = 100;
```

Verify:

```sql
SELECT * FROM public.credits WHERE user_id = 'YOUR_USER_ID';
-- Should show: amount = 100
```

---

## Step 5: Run Smoke Test

The smoke test verifies all components are working:

```bash
# Install dependencies (if needed)
npm install

# Set test user ID (optional, defaults to zeros UUID)
export TEST_USER_ID=your-user-id-here

# Run smoke test
npm run db:smoke
```

**Expected output:**

```
========================================
  Supabase Smoke Test
========================================

ℹ Step 1: Checking environment variables...
✓ NEXT_PUBLIC_SUPABASE_URL: https://xxxxx.supabase.co
✓ SUPABASE_SERVICE_ROLE_KEY: ***

ℹ Step 2: Creating Supabase admin client...
✓ Supabase client created

ℹ Step 3: Testing database tables...
✓ Table 'credits' exists and is accessible
✓ Table 'credit_transactions' exists and is accessible
✓ Table 'generations' exists and is accessible

ℹ Step 4: Testing RPC functions...
✓ get_user_balance() works (current: 100)
✓ adjust_credits(+1) works (new balance: 101)
✓ adjust_credits(-1) works (new balance: 100)

ℹ Step 5: Testing Supabase Storage...
✓ Storage bucket 'generations' exists
✓ Test file uploaded: user-id/photo/smoke_test.png
✓ Public URL: https://...
✓ Test file cleaned up

ℹ Step 6: Testing generations table operations...
✓ Test generation created: uuid
✓ Test generation updated to success
✓ Test generation read successfully
✓ Test generation cleaned up

========================================
  ALL TESTS PASSED! ✓
========================================
```

---

## Step 6: Test /api/infer Endpoint

### Get Auth Token

**Supabase Dashboard:**
1. **Authentication** → **Users** → Select your user
2. **Access Token** (JWT) → Copy the long string starting with `eyJ...`

### Test with curl

```bash
# Set your JWT token
export JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Make inference request
curl -X POST http://localhost:3001/api/infer \
  -H "Content-Type: application/json" \
  -H "Cookie: lr_session=$JWT_TOKEN" \
  -d '{
    "modelId": "seedream_image",
    "inputs": {"prompt": "a beautiful sunset over mountains"},
    "params": {}
  }'
```

**Expected response (after ~10-20 seconds):**

```json
{
  "success": true,
  "urls": ["https://xxxxx.supabase.co/storage/v1/object/public/generations/USER_ID/photo/GEN_ID.png"],
  "meta": {
    "modelId": "seedream_image",
    "generationId": "uuid",
    "taskId": "kie-task-id",
    "duration": 9500
  },
  "newBalance": 92
}
```

---

## Step 7: Verify in Supabase Dashboard

### Credits Table

**Table Editor** → **credits**

Should show updated `amount` (100 → 92)

### Credit Transactions Table

**Table Editor** → **credit_transactions**

Should show new row:
- `amount`: -8
- `type`: "generation"
- `description`: "Seedream (Image): a beautiful sunset..."

### Generations Table

**Table Editor** → **generations**

Should show new row:
- `status`: "success"
- `model`: "seedream_image"
- `prompt`: "a beautiful sunset..."
- `result_urls`: Array with Supabase URL
- `credits_used`: 8

### Storage

**Storage** → **generations** → Navigate to `USER_ID/photo/`

Should show `.png` file with the generated image

---

## Tables Reference

### `credits`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User ID (unique) |
| amount | integer | Current credit balance |
| created_at | timestamptz | When created |
| updated_at | timestamptz | Last updated |

### `credit_transactions`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User ID |
| amount | integer | Amount changed (negative for debit) |
| type | text | Transaction type (generation, purchase, etc.) |
| description | text | Human-readable description |
| metadata | jsonb | Additional data |
| generation_id | uuid | Related generation (if applicable) |
| created_at | timestamptz | When transaction occurred |

### `generations`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User ID |
| type | text | Generation type (photo, video, etc.) |
| model | text | Model ID used |
| prompt | text | User prompt |
| status | text | pending/processing/success/failed |
| result_urls | jsonb | Array of result URLs |
| credits_used | integer | Credits charged |
| preview_path | text | Preview image path (optional) |
| poster_path | text | Video poster path (optional) |
| preview_status | text | Preview generation status |
| metadata | jsonb | Additional data |
| created_at | timestamptz | When created |
| updated_at | timestamptz | Last updated |

---

## RPC Functions

### `get_user_balance(p_user_id UUID)`

Returns user's current credit balance (integer).

**Example:**

```sql
SELECT * FROM get_user_balance('user-id-here');
-- Returns: 100
```

### `adjust_credits(...)`

Atomically adjusts user credits and logs transaction.

**Parameters:**
- `p_user_id` (UUID): User ID
- `p_amount` (INTEGER): Amount to add/subtract
- `p_type` (TEXT): Transaction type
- `p_description` (TEXT): Description (optional)
- `p_generation_id` (UUID): Related generation (optional)
- `p_metadata` (JSONB): Additional data (optional)

**Returns:** JSON with `{ success, new_balance, transaction_id, error }`

**Example:**

```sql
SELECT * FROM adjust_credits(
  'user-id',
  -10,
  'generation',
  'Seedream generation',
  'gen-id',
  '{}'::jsonb
);
```

---

## Troubleshooting

### Error: "Table does not exist"

**Solution:** Run the migration SQL again in SQL Editor.

### Error: "RPC function not found"

**Solution:** Check that functions were created:

```sql
SELECT * FROM pg_proc WHERE proname IN ('adjust_credits', 'get_user_balance');
```

If empty, re-run migration.

### Error: "Storage bucket not found"

**Solution:** Create bucket manually:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('generations', 'generations', true)
ON CONFLICT (id) DO NOTHING;
```

### Error: "Insufficient credits"

**Solution:** Add credits to your user:

```sql
UPDATE public.credits 
SET amount = 100 
WHERE user_id = 'YOUR_USER_ID';
```

### Error: "User not found" in adjust_credits

**Solution:** The function auto-creates user with 0 credits. But to set initial credits:

```sql
INSERT INTO public.credits (user_id, amount)
VALUES ('YOUR_USER_ID', 100)
ON CONFLICT (user_id) DO UPDATE SET amount = 100;
```

---

## Security Notes

### RLS (Row Level Security)

All tables have RLS enabled. Users can only:
- Read their own `credits`
- Read their own `credit_transactions`
- Read/insert/update their own `generations`

### Service Role Key

⚠️ **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to the client!

- Only use in server-side code (API routes, server components)
- Never include in client-side bundles
- Never commit to version control (use `.env.local`)

### Storage Policies

- Public read: Anyone can view images (for sharing)
- Authenticated write: Only authenticated users can upload to their own folders
- Path structure enforces user isolation: `{user_id}/{type}/{file}`

---

## Next Steps

1. ✅ Migration complete
2. ✅ Smoke test passed
3. ✅ API working
4. 🚀 Ready for production!

**Optional enhancements:**
- Add webhook for purchase integration
- Add preview generation for videos
- Add analytics queries
- Set up database backups

---

## Support

If you encounter issues:

1. Check Supabase Dashboard → **Logs** for errors
2. Check API route logs in terminal
3. Run smoke test: `npm run db:smoke`
4. Verify environment variables in `.env.local`

For Supabase-specific help: [Supabase Docs](https://supabase.com/docs)

