# 🚀 Quick Start - Supabase Integration

3-minute setup for LensRoom Workflow Editor with Supabase.

---

## Step 1: Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
KIE_API_KEY=your_kie_api_key
USE_MOCK_INFERENCE=false
```

Get credentials from **Supabase Dashboard** → **Settings** → **API**

---

## Step 2: Run SQL Migration

```bash
# Copy entire SQL file
cat supabase/migrations/0001_credits_generations.sql
```

Paste in **Supabase Dashboard** → **SQL Editor** → Click **Run**

---

## Step 3: Add Credits

Get your user ID from **Authentication** → **Users** → Copy UID

Run in SQL Editor:

```sql
INSERT INTO public.credits (user_id, amount)
VALUES ('YOUR_USER_ID_HERE', 100)
ON CONFLICT (user_id) DO UPDATE SET amount = 100;
```

---

## Step 4: Install & Test

```bash
# Install dependencies
npm install

# Run smoke test
npm run db:smoke

# Start dev server
npm run dev
```

**Expected output:**
```
✓ All tests passed!
```

---

## Step 5: Test API

```bash
# Get JWT token from: Authentication → Users → your user → Access Token
export JWT_TOKEN="eyJ..."

# Test inference
curl -X POST http://localhost:3001/api/infer \
  -H "Content-Type: application/json" \
  -H "Cookie: lr_session=$JWT_TOKEN" \
  -d '{
    "modelId": "seedream_image",
    "inputs": {"prompt": "a cute robot"},
    "params": {}
  }'
```

**Wait ~10-20 seconds → Get Supabase URL!**

---

## ✅ Done!

Check results:
- **Table Editor** → **generations** → See your generation
- **Storage** → **generations** → See your image
- **Table Editor** → **credits** → Balance decreased by 8

---

## 📚 Full Documentation

- **Setup Guide:** `docs/SUPABASE_SETUP.md`
- **Implementation Details:** `PRODUCTION_READY.md`

**Happy coding! 🎉**

