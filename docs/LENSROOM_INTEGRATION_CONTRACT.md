# LensRoom Integration Contract

**Version:** 1.0  
**Last Updated:** 2024-12-24

---

## 🎯 Purpose

This document defines the **integration contract** between:
- **LensRoom Workflow Editor** (this repository)
- **LensRoom Backend** (main system)

This contract ensures clear separation of concerns and prevents architectural drift.

---

## A) Boundaries of Responsibility

### LensRoom Workflow Editor (This Repository)

**Owns:**
- ✅ Node-based workflow UI
- ✅ Visual workflow editor (React Flow)
- ✅ Client-side workflow state (Zustand)
- ✅ API proxy endpoints: `/api/models`, `/api/infer`
- ✅ Model registry: `src/config/modelRegistry.ts`
- ✅ UI components for workflow nodes

**Does NOT Own:**
- ❌ User authentication/sessions (uses LensRoom's)
- ❌ Credit balance ledger (uses LensRoom's)
- ❌ Storage infrastructure (uses LensRoom's Supabase)
- ❌ User management
- ❌ Payment processing

### LensRoom Backend (Main System)

**Owns:**
- ✅ Authentication & sessions (`lr_session`, Supabase auth)
- ✅ Credit balance system (`public.credits`, `public.credit_transactions`)
- ✅ Supabase Storage bucket (`generations`)
- ✅ Database tables (`credits`, `credit_transactions`, `generations`)
- ✅ RPC functions (`adjust_credits`, `get_user_balance`)
- ✅ User profiles & Telegram integration

---

## B) Authentication (How We Identify Users)

### Session Sources (Priority Order)

1. **`lr_session` Cookie** (JWT, httpOnly)
   - Set by LensRoom backend
   - Contains user_id claim
   - Preferred method

2. **Supabase Session Cookie**
   - Managed by `@supabase/ssr`
   - Fallback if `lr_session` not present

3. **`Authorization: Bearer` Header**
   - For API clients
   - Contains Supabase JWT

### Requirements

**MUST:**
- ✅ Extract `user_id` (UUID) from session
- ✅ Return `401 Unauthorized` if no valid session
- ✅ Use `src/lib/auth/getUserId.ts` utility
- ✅ Never trust client-provided user_id

**MUST NOT:**
- ❌ Create new authentication system
- ❌ Store sessions locally
- ❌ Bypass authentication for testing in production

### Implementation

```typescript
// ✅ CORRECT
import { getUserId } from "@/lib/auth/getUserId";
const userId = await getUserId(request);
if (!userId) return 401;

// ❌ WRONG
const userId = request.headers.get("x-user-id"); // Never trust client
```

---

## C) Credits (Single Source of Truth)

### Data Model

**ONLY USE:**

```sql
-- Balance table (one row per user)
public.credits (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE NOT NULL,
  amount integer NOT NULL CHECK (amount >= 0),
  created_at timestamptz,
  updated_at timestamptz
)

-- Transaction log (immutable history)
public.credit_transactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  amount integer NOT NULL,  -- negative for debit, positive for credit
  type text NOT NULL,        -- 'generation', 'purchase', 'bonus', 'refund'
  description text,
  metadata jsonb,
  payment_id uuid,
  generation_id uuid,
  created_at timestamptz
)
```

### Operations

**MUST:**
- ✅ Use `public.adjust_credits()` RPC for ALL balance changes
- ✅ Check balance BEFORE starting expensive operations
- ✅ Link transactions to generations via `generation_id`
- ✅ Use atomic operations (no manual UPDATE on credits)

**MUST NOT:**
- ❌ Create alternative balance tables (e.g., `public.users(credits)`)
- ❌ Directly UPDATE `public.credits.amount`
- ❌ Skip transaction logging
- ❌ Store balance in memory/cache without DB source of truth

### adjust_credits() Function Contract

```sql
-- Function signature
public.adjust_credits(
  p_user_id uuid,
  p_amount integer,           -- negative to deduct, positive to add
  p_type text,                -- 'generation' | 'purchase' | 'bonus' | 'refund'
  p_description text,         -- human-readable description
  p_generation_id uuid,       -- optional, link to generations table
  p_metadata jsonb            -- optional, additional data
) RETURNS json

-- Returns
{
  "success": boolean,
  "new_balance": integer | null,
  "transaction_id": uuid | null,
  "error": string | null
}
```

### Example Usage

```typescript
// ✅ CORRECT: Atomic credit deduction
const result = await adjustCredits(
  userId,
  -8,                    // deduct 8 credits
  "generation",
  "Seedream: a cute cat",
  generationId
);

if (!result.success) {
  // Handle insufficient credits
  return 402;
}

// ❌ WRONG: Manual UPDATE
await supabase
  .from("credits")
  .update({ amount: currentBalance - 8 })
  .eq("user_id", userId);
```

---

## D) Generations (History & Tracking)

### Data Model

```sql
public.generations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,              -- 'photo' | 'video' | 'edit'
  model text NOT NULL,             -- from MODEL_REGISTRY
  prompt text,
  status text NOT NULL,            -- 'pending' | 'processing' | 'success' | 'failed'
  result_urls jsonb DEFAULT '[]', -- array of public URLs
  credits_used integer NOT NULL,
  preview_path text,               -- optional: preview image path
  poster_path text,                -- optional: video poster path
  preview_status text,             -- 'none' | 'processing' | 'ready'
  metadata jsonb DEFAULT '{}',     -- additional data
  created_at timestamptz,
  updated_at timestamptz
)
```

### /api/infer Requirements

**MUST:**

1. **Create generation record BEFORE charging:**
   ```typescript
   const generationId = crypto.randomUUID();
   await createGeneration(userId, generationId, "photo", modelId, prompt, cost, {
     status: "processing"
   });
   ```

2. **Deduct credits atomically:**
   ```typescript
   await adjustCredits(userId, -cost, "generation", description, generationId);
   ```

3. **Update on success:**
   ```typescript
   await updateGenerationSuccess(generationId, [publicUrl], {
     taskId: kieTaskId,
     duration: 9500
   });
   ```

4. **Update on failure:**
   ```typescript
   await updateGenerationFailed(generationId, errorMessage);
   ```

**MUST NOT:**
- ❌ Skip generation record creation
- ❌ Store results only in memory
- ❌ Leave status as 'processing' forever
- ❌ Return temporary URLs to client (upload to Storage first)

### Status Flow

```
pending → processing → success
                    → failed
```

---

## E) Storage (Supabase Storage)

### Bucket Configuration

**Bucket Name:** `generations`

**Public:** Yes (for image sharing)

**Path Structure:**
```
generations/
  {user_id}/
    photo/
      {generation_id}.png
      {generation_id}.webp
    video/
      {generation_id}.mp4
    previews/
      {generation_id}_preview.webp
    posters/
      {generation_id}_poster.jpg
```

### Requirements

**MUST:**
- ✅ Upload to Supabase Storage BEFORE returning to client
- ✅ Return public URL from `getPublicUrl()`
- ✅ Use consistent path structure: `{userId}/{type}/{generationId}.{ext}`
- ✅ Set correct `contentType` header
- ✅ Use `upsert: true` for idempotency

**MUST NOT:**
- ❌ Return temporary URLs from Kie.ai directly
- ❌ Store files locally on server
- ❌ Use different bucket or path structure
- ❌ Skip file upload step

### Example Implementation

```typescript
// ✅ CORRECT
async function uploadToStorage(userId: string, generationId: string, kieUrl: string) {
  // 1. Download from Kie.ai
  const response = await fetch(kieUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  
  // 2. Upload to Supabase
  const path = `${userId}/photo/${generationId}.png`;
  await supabase.storage
    .from("generations")
    .upload(path, buffer, { contentType: "image/png", upsert: true });
  
  // 3. Get public URL
  const { data } = supabase.storage
    .from("generations")
    .getPublicUrl(path);
  
  return data.publicUrl;
}

// ❌ WRONG: Returning temporary URL
return { urls: [kieResult.urls[0]] }; // Expires after 24h!
```

---

## F) Model Registry (Extensibility)

### Source of Truth

**File:** `src/config/modelRegistry.ts`

```typescript
export const MODEL_REGISTRY: ModelDef[] = [
  {
    id: "seedream_image",
    title: "Seedream (Image)",
    provider: "kie",
    capability: "image",
    enabled: true,
    creditCost: 8,
    paramsSchema: { width: {...}, height: {...} }
  },
  // ... more models
];
```

### Adding New Models

1. Add entry to `MODEL_REGISTRY`
2. Implement inference logic in `/api/infer`
3. Models automatically appear in UI via `GET /api/models`

### Requirements

**MUST:**
- ✅ Define all available models in registry
- ✅ Include `creditCost` for each model
- ✅ Set `enabled: false` for WIP models
- ✅ UI loads models from `/api/models` endpoint

**MUST NOT:**
- ❌ Hardcode models in UI components
- ❌ Bypass registry for cost calculation
- ❌ Enable models without implementation
- ❌ Store model list in database

---

## G) Invariants (What NOT to Do)

### ❌ Database Schema

**NEVER:**
- Create alternative balance tables (`public.users(credits)`)
- Modify existing migrations (only add new ones)
- Change `credits` or `credit_transactions` schema without approval
- Bypass RPC functions with direct SQL

**REASON:** Breaks integration with main LensRoom system

---

### ❌ API Keys & Security

**NEVER:**
- Expose `SUPABASE_SERVICE_ROLE_KEY` to client
- Expose `KIE_API_KEY` to client
- Use `NEXT_PUBLIC_*` prefix for secrets
- Trust client-provided `user_id`

**REASON:** Security breach

---

### ❌ UI/UX Changes

**NEVER (without explicit request):**
- Redesign workflow editor
- Change node types or behavior
- Remove existing features
- Modify workflow execution logic

**REASON:** Breaking changes for existing users

---

### ❌ Authentication

**NEVER:**
- Create new auth system
- Store passwords or tokens
- Implement custom JWT validation
- Bypass LensRoom sessions

**REASON:** Duplicate auth logic, security risk

---

### ❌ Credits

**NEVER:**
- Create alternative credit system
- Cache balances without DB sync
- Skip transaction logging
- Manually UPDATE credits table

**REASON:** Balance discrepancies, lost history

---

## H) API Contracts

### GET /api/models

**Response:**
```json
[
  {
    "id": "seedream_image",
    "title": "Seedream (Image)",
    "provider": "kie",
    "capability": "image",
    "enabled": true,
    "creditCost": 8,
    "paramsSchema": { ... }
  }
]
```

**MUST:**
- Return only `enabled: true` models
- Include accurate `creditCost`
- Never expose API keys

---

### POST /api/infer

**Request:**
```json
{
  "modelId": "seedream_image",
  "inputs": {
    "prompt": "a cute cat"
  },
  "params": {
    "width": 1024,
    "height": 1024
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "urls": ["https://xxxxx.supabase.co/storage/v1/object/public/generations/..."],
  "meta": {
    "modelId": "seedream_image",
    "generationId": "uuid",
    "taskId": "kie-task-id",
    "duration": 9500
  },
  "newBalance": 92
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Insufficient credits"
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized (no session)
- `402` - Payment Required (insufficient credits)
- `404` - Model not found
- `429` - Rate limit exceeded
- `500` - Server error
- `502` - AI provider error
- `504` - Timeout

**MUST:**
1. Check auth (401 if no session)
2. Check credits (402 if insufficient)
3. Create generation record
4. Deduct credits
5. Call AI provider
6. Upload to Storage
7. Update generation record
8. Return public URL + new balance

---

## I) Error Handling

### Generation Failures

**If error occurs after credit deduction:**

1. Update generation status to `'failed'`
2. Store error in `metadata.error`
3. **Credits are NOT refunded automatically**
4. Manual refund requires admin action

**Reason:** Prevents abuse (retry loops to get free generations)

### Storage Upload Failures

**If Supabase Storage upload fails:**

1. Update generation to `'failed'`
2. Return 500 error
3. **Credits are already deducted** (logged in transaction)
4. Manual investigation required

---

## J) Verification

### How to Verify Compliance

Run verification script:

```bash
npm run verify:integration
```

**Checks:**
- No alternative balance tables in code
- `adjust_credits()` is used in `/api/infer`
- Bucket name is `"generations"`
- No exposed API keys
- Correct import paths

---

## K) Evolution & Changes

### When to Update This Contract

- Adding new authentication method
- Changing database schema
- Adding new storage bucket
- Modifying credit calculation logic
- Breaking API changes

### How to Update

1. Update this document first
2. Update implementation
3. Run verification script
4. Update tests
5. Version bump (semver)

### Approval Required

Changes to these sections require explicit approval:
- Section C (Credits)
- Section D (Generations)
- Section E (Storage)
- Section G (Invariants)

---

## L) Quick Reference

### Key Files

| Component | File |
|-----------|------|
| Model Registry | `src/config/modelRegistry.ts` |
| Auth | `src/lib/auth/getUserId.ts` |
| Credits | `src/lib/supabase/server.ts` |
| Generations | `src/lib/generations/db.ts` |
| Storage | `src/lib/storage/upload.ts` |
| API: models | `src/app/api/models/route.ts` |
| API: infer | `src/app/api/infer/route.ts` |
| Migration | `supabase/migrations/0001_credits_generations.sql` |

### Key Functions

```typescript
// Auth
getUserId(request: NextRequest): Promise<string | null>

// Credits
adjustCredits(userId, amount, type, description, generationId?, metadata?): Promise<number>
getUserBalance(userId): Promise<number>

// Generations
createGeneration(userId, generationId, type, model, prompt, cost, metadata)
updateGenerationSuccess(generationId, resultUrls, metadata)
updateGenerationFailed(generationId, errorMessage)

// Storage
uploadGenerationToStorage(userId, generationId, imageUrl, type): Promise<string>
```

---

## M) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12-24 | Initial contract |

---

## ✅ Compliance Checklist

- [ ] Using `public.credits` and `public.credit_transactions` only
- [ ] All balance changes via `adjust_credits()`
- [ ] Generation records created before charging
- [ ] Files uploaded to Supabase Storage before returning
- [ ] Auth via `getUserId()` from LensRoom sessions
- [ ] No API keys exposed to client
- [ ] Models loaded from registry, not hardcoded
- [ ] Verification script passes

---

**This contract is binding. Violations will break integration with LensRoom.**

