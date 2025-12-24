# Environment Variables Template

Copy these variables to `.env.local` for local development or add to Vercel Environment Variables for production.

## Required for Production

```bash
# KIE.AI API (Image/Video Generation)
KIE_API_KEY=__KIE_KEY_REDACTED__

# Anthropic API (LLM Text Generation)
ANTHROPIC_API_KEY=sk-ant-api03-__REDACTED__
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Supabase (Database + Storage + Auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1amp2bnVia295eG1tZnJubGx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDg4MTg4NCwiZXhwIjoyMDUwNDU3ODg0fQ.jP-pVg8u0qOD6Q9Fp_Y7Ep0u8SXDW89fEjJrMr2Lqok
```

## Optional (Development/Testing)

```bash
# Test Mode (bypass auth)
TEST_MODE=true
TEST_USER_ID=1a13c194-06ce-4d18-8b36-b9eaf0a5d5d3

# Mock Inference (fake results)
USE_MOCK_INFERENCE=false
```

## Security Notes

- ❌ Never commit `.env.local` to git
- ❌ Never use `NEXT_PUBLIC_` for secrets
- ✅ All API keys are server-side only

