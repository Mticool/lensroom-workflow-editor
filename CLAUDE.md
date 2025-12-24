# Claude/Cursor Project Rules

**⚠️ BEFORE ANY CHANGES: Read `docs/LENSROOM_INTEGRATION_CONTRACT.md`**

---

## 🚨 Critical Invariants (DO NOT VIOLATE)

### 1. Credits System
- ✅ ONLY use `public.credits` and `public.credit_transactions`
- ✅ ALL balance changes via `adjust_credits()` RPC
- ❌ NEVER create alternative balance tables
- ❌ NEVER manually UPDATE credits table

### 2. Authentication
- ✅ ONLY use `getUserId()` from `src/lib/auth/getUserId.ts`
- ✅ Return 401 if no valid session
- ❌ NEVER trust client-provided user_id
- ❌ NEVER create new auth system

### 3. Storage
- ✅ ONLY use Supabase Storage bucket `"generations"`
- ✅ Path: `{userId}/{type}/{generationId}.ext`
- ✅ Upload before returning to client
- ❌ NEVER return temporary URLs from AI providers

### 4. Generations
- ✅ Create record BEFORE charging credits
- ✅ Update status: processing → success/failed
- ✅ Link to credit_transactions via generation_id
- ❌ NEVER skip generation record

### 5. API Keys
- ✅ Keep on server only (`SUPABASE_SERVICE_ROLE_KEY`, `KIE_API_KEY`)
- ❌ NEVER use `NEXT_PUBLIC_*` for secrets
- ❌ NEVER expose to client

### 6. UI/UX
- ❌ NEVER redesign workflow editor without explicit request
- ❌ NEVER change node behavior
- ❌ NEVER remove existing features

### 7. Database
- ✅ ONLY add new migrations, never modify existing
- ❌ NEVER change credits/generations schema without approval
- ❌ NEVER bypass RPC functions

### 8. Models
- ✅ ONLY use `src/config/modelRegistry.ts` as source of truth
- ✅ UI loads from `/api/models` endpoint
- ❌ NEVER hardcode models in components

---

## 📋 Before Making Changes

1. Read `docs/LENSROOM_INTEGRATION_CONTRACT.md`
2. Check which component you're modifying
3. Verify it's within editor's responsibility
4. Run `npm run verify:integration` after changes

---

## 🔍 Quick Reference

### Responsibility Matrix

| Component | Editor Owns | LensRoom Owns |
|-----------|-------------|---------------|
| Workflow UI | ✅ | ❌ |
| `/api/infer` | ✅ | ❌ |
| Auth/Sessions | ❌ | ✅ |
| Credits | ❌ | ✅ |
| Storage | ❌ | ✅ |
| Database | ❌ | ✅ |

### When in Doubt

**ASK YOURSELF:**
- Does this create a new balance table? → ❌ DON'T
- Does this bypass `adjust_credits()`? → ❌ DON'T
- Does this expose API keys? → ❌ DON'T
- Does this change existing migrations? → ❌ DON'T
- Does this break integration contract? → ❌ DON'T

**IF UNSURE:** Read the contract, check with user

---

## ✅ Verification

After ANY changes:

```bash
npm run verify:integration
```

Must show: `✅ ALL CHECKS PASSED`

---

## 📚 Full Documentation

- **Integration Contract:** `docs/LENSROOM_INTEGRATION_CONTRACT.md`
- **Supabase Setup:** `docs/SUPABASE_SETUP.md`
- **SQL Generator:** `docs/SQL_GENERATOR.md`
- **Production Ready:** `PRODUCTION_READY.md`

---

**Remember: This editor is part of LensRoom ecosystem. Integration contract is binding.**
