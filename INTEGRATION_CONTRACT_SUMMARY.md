# ✅ Integration Contract Established

**Status:** Complete  
**Date:** 2024-12-24

---

## 📋 What Was Created

### 1. Integration Contract
**File:** `docs/LENSROOM_INTEGRATION_CONTRACT.md`

Defines the binding contract between:
- **LensRoom Workflow Editor** (this repo)
- **LensRoom Backend** (main system)

**Sections:**
- ✅ A) Boundaries of Responsibility
- ✅ B) Authentication (session sources, getUserId)
- ✅ C) Credits (single source of truth, adjust_credits RPC)
- ✅ D) Generations (tracking, status flow)
- ✅ E) Storage (Supabase bucket, paths)
- ✅ F) Model Registry (extensibility)
- ✅ G) Invariants (what NOT to do)
- ✅ H) API Contracts (/api/models, /api/infer)
- ✅ I) Error Handling
- ✅ J) Verification
- ✅ K) Evolution & Changes
- ✅ L) Quick Reference
- ✅ M) Version History

---

### 2. Claude/Cursor Rules
**File:** `CLAUDE.md`

Short reference for AI assistants with:
- 🚨 8 Critical Invariants (DO NOT VIOLATE)
- 📋 Pre-change checklist
- 🔍 Responsibility matrix
- ✅ Verification command
- 📚 Documentation links

**Key Message:**
```
⚠️ BEFORE ANY CHANGES: Read docs/LENSROOM_INTEGRATION_CONTRACT.md
```

---

### 3. Verification Script
**File:** `scripts/verifyIntegration.ts`

**NPM Command:** `npm run verify:integration`

**Checks:**
1. ✅ No alternative balance tables (`public.users(credits)`)
2. ✅ `adjust_credits()` used in `/api/infer`
3. ✅ Storage bucket is `"generations"`
4. ✅ Auth via `getUserId()`
5. ✅ No exposed API keys in client code
6. ✅ Generations tracking implemented
7. ✅ Model registry configured

**Output:**
```
✅ ALL CHECKS PASSED (7/7)
Integration contract is being followed correctly
```

**Exit Code:**
- `0` - All checks passed
- `1` - Some checks failed

---

## 🎯 Key Invariants

### ❌ NEVER Do This:

1. **Alternative Balance Tables**
   ```typescript
   // ❌ WRONG
   CREATE TABLE public.users (credits INTEGER);
   ```

2. **Direct Credit Updates**
   ```typescript
   // ❌ WRONG
   await supabase
     .from("credits")
     .update({ amount: newBalance });
   ```

3. **Client-Side Secrets**
   ```typescript
   // ❌ WRONG
   const key = process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY;
   ```

4. **Trust Client User ID**
   ```typescript
   // ❌ WRONG
   const userId = request.headers.get("x-user-id");
   ```

5. **Skip Generation Records**
   ```typescript
   // ❌ WRONG
   return { urls: [kieUrl] }; // No DB record
   ```

---

### ✅ ALWAYS Do This:

1. **Use adjust_credits()**
   ```typescript
   // ✅ CORRECT
   await adjustCredits(userId, -8, "generation", description, generationId);
   ```

2. **Use getUserId()**
   ```typescript
   // ✅ CORRECT
   const userId = await getUserId(request);
   if (!userId) return 401;
   ```

3. **Upload to Storage**
   ```typescript
   // ✅ CORRECT
   const publicUrl = await uploadGenerationToStorage(userId, generationId, kieUrl, "photo");
   ```

4. **Track Generations**
   ```typescript
   // ✅ CORRECT
   await createGeneration(...);
   await updateGenerationSuccess(...);
   ```

5. **Use Model Registry**
   ```typescript
   // ✅ CORRECT
   import { getModelById } from "@/config/modelRegistry";
   ```

---

## 🔍 Verification Workflow

### Before Committing:

```bash
# Run verification
npm run verify:integration
```

**Expected:**
```
✅ ALL CHECKS PASSED (7/7)
```

If any checks fail, fix violations before committing.

---

### What Gets Checked:

| Check | Description | How |
|-------|-------------|-----|
| Balance Tables | No `public.users(credits)` | String search in source files |
| Credits API | Uses `adjustCredits()` | Check `/api/infer` imports |
| Storage | Bucket is `"generations"` | Check `upload.ts` |
| Auth | Uses `getUserId()` | Check `/api/infer` imports |
| API Keys | No client exposure | Check client components |
| Generations | Records created/updated | Check `/api/infer` calls |
| Registry | Uses `MODEL_REGISTRY` | Check `/api/models` |

---

## 📂 File Structure

```
ai-workflow-builder/
├── CLAUDE.md                               ← AI rules (quick reference)
├── docs/
│   └── LENSROOM_INTEGRATION_CONTRACT.md    ← Full contract (source of truth)
├── scripts/
│   └── verifyIntegration.ts                ← Verification script
└── package.json                            ← Added verify:integration script
```

---

## 🚀 Usage Guide

### For Developers

**Before making changes:**

1. Read `CLAUDE.md` for quick rules
2. Read `docs/LENSROOM_INTEGRATION_CONTRACT.md` for details
3. Make changes
4. Run `npm run verify:integration`
5. Fix any violations
6. Commit

### For AI Assistants (Claude/Cursor)

**On every session start:**

1. Read `CLAUDE.md`
2. Check current task against invariants
3. If touching credits/auth/storage → Read full contract
4. After changes → Suggest running verification

### For Code Review

**Checklist:**

- [ ] `npm run verify:integration` passes
- [ ] No new balance tables
- [ ] Auth via `getUserId()`
- [ ] Credits via `adjust_credits()`
- [ ] Storage via Supabase
- [ ] Generations tracked
- [ ] No exposed secrets

---

## 📊 Current Status

### ✅ Compliant

All checks pass:

```
✅ No Alternative Balance Tables
✅ adjust_credits() Usage
✅ Storage Bucket
✅ Authentication
✅ API Key Security
✅ Generations Tracking
✅ Model Registry
```

### 📋 Test Results

```bash
$ npm run verify:integration

══════════════════════════════════════════════════════════════════════
  Integration Contract Verification
══════════════════════════════════════════════════════════════════════

ℹ️  Checking compliance with docs/LENSROOM_INTEGRATION_CONTRACT.md

✅ No alternative balance tables found
✅ /api/infer correctly uses adjustCredits()
✅ Storage correctly uses bucket "generations"
✅ Auth correctly implemented with getUserId()
✅ No exposed API keys in client code
✅ Generation tracking correctly implemented
✅ Model registry correctly configured

══════════════════════════════════════════════════════════════════════
  ✅ ALL CHECKS PASSED (7/7)
  Integration contract is being followed correctly
══════════════════════════════════════════════════════════════════════
```

---

## 🎓 Learning from This

### Why This Matters

**Problem:** Without clear boundaries, projects drift:
- Duplicate systems (2 balance tables)
- Security holes (exposed keys)
- Integration breaks (incompatible changes)

**Solution:** Explicit contract + automated verification

### Benefits

1. **Clarity** - Everyone knows boundaries
2. **Safety** - Automated checks prevent violations
3. **Speed** - Less back-and-forth on arch decisions
4. **Quality** - Consistent patterns across codebase

---

## 📚 Documentation

### Full Docs

| File | Purpose | Audience |
|------|---------|----------|
| `docs/LENSROOM_INTEGRATION_CONTRACT.md` | Complete contract | All developers |
| `CLAUDE.md` | Quick rules | AI assistants |
| `scripts/verifyIntegration.ts` | Automated checks | CI/CD, developers |
| `INTEGRATION_CONTRACT_SUMMARY.md` | This file | Quick reference |

### Related Docs

- `docs/SUPABASE_SETUP.md` - How to setup database
- `docs/SQL_GENERATOR.md` - SQL generation utility
- `PRODUCTION_READY.md` - Implementation details
- `QUICKSTART.md` - Quick setup guide

---

## 🔄 Updates

### Version 1.0 (2024-12-24)

**Created:**
- Integration contract document
- AI assistant rules
- Verification script
- This summary

**Status:** ✅ All checks passing

---

## ✅ Summary

**3 files created:**
1. `docs/LENSROOM_INTEGRATION_CONTRACT.md` - Complete contract
2. `CLAUDE.md` - AI assistant rules
3. `scripts/verifyIntegration.ts` - Verification script

**What's fixed:**
- ✅ Clear boundaries between Editor and LensRoom
- ✅ Single source of truth for credits
- ✅ No alternative balance tables
- ✅ Proper auth flow
- ✅ Consistent storage paths
- ✅ Generation tracking
- ✅ API key security
- ✅ Model registry pattern

**How to verify:**
```bash
npm run verify:integration
```

**Result:** `✅ ALL CHECKS PASSED (7/7)`

---

**Integration contract is established and enforced! 🎉**

