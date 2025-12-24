# Environment Variables Template

Copy these variables to `.env.local` for local development or add to Vercel Environment Variables for production.

## Required for Production

```bash
# KIE.AI API (Image/Video Generation)
KIE_API_KEY=your_kie_api_key_here

# Anthropic API (LLM Text Generation)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Supabase (Database + Storage + Auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

## Optional (Development/Testing)

```bash
# Test Mode (bypass auth globally)
TEST_MODE=true
TEST_USER_ID=1a13c194-06ce-4d18-8b36-b9eaf0a5d5d3

# Allow Anonymous Inference (bypass auth for /api/infer only)
ALLOW_ANON_INFER=true
# TEST_USER_ID is required when ALLOW_ANON_INFER=true

# Supabase Fallback Mode (MVP mode - works without Supabase)
INFER_SUPABASE_OPTIONAL=true
# When true: inference works even if Supabase env vars missing or network fails
# Returns Kie.ai URLs directly, skips credits/generations/storage
# Use for: Vercel preview, local testing without Supabase setup

# Mock Inference (fake results)
USE_MOCK_INFERENCE=false
```

## Operating Modes

### Strict Mode (Production)
```bash
INFER_SUPABASE_OPTIONAL=false  # or omit
# Requires: All Supabase env vars configured
# Behavior: Full tracking (credits, generations, storage)
# Use for: Production deployments
```

### MVP Mode (Testing/Preview)
```bash
INFER_SUPABASE_OPTIONAL=true
ALLOW_ANON_INFER=true
TEST_USER_ID=your-test-uuid
# Requires: Only KIE_API_KEY
# Behavior: Inference works, returns Kie.ai URLs directly
# Skips: Credits, generations table, storage upload
# Use for: Vercel preview, local testing without Supabase
```

## Security Notes

- ❌ Never commit `.env.local` to git
- ❌ Never use `NEXT_PUBLIC_` for secrets
- ✅ All API keys are server-side only

