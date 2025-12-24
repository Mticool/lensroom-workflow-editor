# Environment Variables

Required environment variables for LensRoom Workflow Editor.

---

## Required Variables

### Kie.ai API

```env
KIE_API_KEY=your_kie_api_key_here
```

Get your API key from [Kie.ai Dashboard](https://kie.ai)

---

### Anthropic API (for LLM text generation)

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**ANTHROPIC_API_KEY:**
- Get from [Anthropic Console](https://console.anthropic.com/)
- Required for `anthropic_text` model

**ANTHROPIC_MODEL:**
- Default: `claude-3-5-sonnet-20241022`
- Options: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`, `claude-3-haiku-20240307`
- Optional (uses default if not set)

---

### Supabase

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Get from:** Supabase Dashboard → Settings → API

⚠️ **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to client!

---

## Optional Variables

### Test Mode (for Vercel/Staging)

```env
TEST_MODE=false
TEST_USER_ID=00000000-0000-0000-0000-000000000000
```

**TEST_MODE:**
- `"true"` - Bypass auth globally, use `TEST_USER_ID` for ALL requests
- `"false"` or unset - Normal authentication

**TEST_USER_ID:**
- Must be valid UUID
- Must exist in `public.credits` table
- Used by both `TEST_MODE` and `ALLOW_ANON_INFER`

**Use case:** Vercel preview deployments without auth setup

---

### Anonymous Inference Mode (for Development)

```env
ALLOW_ANON_INFER=false
TEST_USER_ID=00000000-0000-0000-0000-000000000000
```

**ALLOW_ANON_INFER:**
- `"true"` - Allow `/api/infer` requests without auth session, use `TEST_USER_ID`
- `"false"` or unset - Require authentication for `/api/infer`

**How it works:**
1. `/api/infer` tries to get userId from session (cookie/JWT)
2. If no session found:
   - If `ALLOW_ANON_INFER=true` AND `TEST_USER_ID` is set → use TEST_USER_ID
   - Otherwise → return 401 Unauthorized

**Differences from TEST_MODE:**

| Feature | TEST_MODE | ALLOW_ANON_INFER |
|---------|-----------|------------------|
| Scope | All API routes | Only `/api/infer` |
| Auth bypass | Global | Fallback only |
| Use case | Staging/preview | Local dev/testing |

**⚠️ Security Warning:**
- Never enable `ALLOW_ANON_INFER` in production!
- Anyone can make inference requests using your TEST_USER_ID credits
- Use only for local development or secure test environments

**Use case:** Testing inference without setting up full auth flow locally

---

### Mock Inference (for Development)

```env
USE_MOCK_INFERENCE=false
```

**Values:**
- `"true"` - Return fake URLs, don't charge credits, don't write to DB
- `"false"` or unset - Real Kie.ai inference

**Use case:** Testing UI without API costs

---

## Setup Instructions

### Local Development

Create `.env.local`:

```env
KIE_API_KEY=your_key
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional
TEST_MODE=false
USE_MOCK_INFERENCE=false
```

### Vercel Deployment

Add to **Vercel Dashboard** → **Settings** → **Environment Variables**:

**Production:**
```
KIE_API_KEY=prod_key
NEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=prod_anon_key
SUPABASE_SERVICE_ROLE_KEY=prod_service_role_key
TEST_MODE=false
USE_MOCK_INFERENCE=false
```

**Preview/Staging:**
```
KIE_API_KEY=dev_key
NEXT_PUBLIC_SUPABASE_URL=https://dev.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dev_anon_key
SUPABASE_SERVICE_ROLE_KEY=dev_service_role_key
TEST_MODE=true
TEST_USER_ID=your-test-user-uuid
USE_MOCK_INFERENCE=false
```

---

## Validation

Environment variables are validated at runtime:

- Missing `KIE_API_KEY` → 500 error
- Missing `SUPABASE_*` → Server error on startup
- `TEST_MODE=true` but invalid `TEST_USER_ID` → 500 error

---

## Security Notes

### ✅ Server-Only Variables

These are NEVER exposed to client:
- `SUPABASE_SERVICE_ROLE_KEY`
- `KIE_API_KEY`

### ✅ Client-Exposed Variables

These are safe to expose:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### ❌ Never Do This

```env
# ❌ WRONG - Exposes secret to client!
NEXT_PUBLIC_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_KIE_API_KEY=...
```

---

## Troubleshooting

### "KIE_API_KEY missing"

Add to `.env.local` or Vercel environment variables

### "User not found" in TEST_MODE

1. Check `TEST_USER_ID` is valid UUID
2. Check user exists in `public.credits`:
   ```sql
   SELECT * FROM public.credits WHERE user_id = 'your-uuid';
   ```
3. If not exists, create:
   ```sql
   INSERT INTO public.credits (user_id, amount)
   VALUES ('your-uuid', 100);
   ```

### "Insufficient credits" in tests

Add credits to test user:
```sql
UPDATE public.credits SET amount = 1000 WHERE user_id = 'your-test-uuid';
```

---

## Quick Reference

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `KIE_API_KEY` | ✅ | - | Kie.ai API access |
| `ANTHROPIC_API_KEY` | ✅ | - | Anthropic API access |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | - | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ❌ | - | Supabase anon key (if using client auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | - | Supabase admin access |
| `TEST_MODE` | ❌ | `false` | Bypass auth globally |
| `TEST_USER_ID` | ❌ | - | Test user UUID (for TEST_MODE / ALLOW_ANON_INFER) |
| `ALLOW_ANON_INFER` | ❌ | `false` | Allow /api/infer without auth |
| `USE_MOCK_INFERENCE` | ❌ | `false` | Mock AI responses |

