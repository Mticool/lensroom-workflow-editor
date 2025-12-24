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

