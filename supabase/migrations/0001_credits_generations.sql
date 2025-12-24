-- ============================================
-- LensRoom Workflow - Credits & Generations Schema
-- Version: 0001
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Credits Table
-- ============================================
-- Stores user credit balances
CREATE TABLE IF NOT EXISTS public.credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  amount INTEGER DEFAULT 0 NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON public.credits(user_id);

-- ============================================
-- 2. Credit Transactions Table
-- ============================================
-- Logs all credit changes
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  payment_id UUID,
  generation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id 
  ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_generation_id 
  ON public.credit_transactions(generation_id);

-- ============================================
-- 3. Generations Table
-- ============================================
-- Stores AI generation results
CREATE TABLE IF NOT EXISTS public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  result_urls JSONB DEFAULT '[]'::jsonb,
  credits_used INTEGER DEFAULT 0 NOT NULL,
  preview_path TEXT,
  poster_path TEXT,
  preview_status TEXT DEFAULT 'none',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_generations_user_id 
  ON public.generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_status 
  ON public.generations(status);

-- ============================================
-- 4. RPC Function: adjust_credits
-- ============================================
-- Atomically adjusts user credits and logs transaction
-- Returns: { success: boolean, new_balance: int, transaction_id: uuid }

CREATE OR REPLACE FUNCTION public.adjust_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_generation_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Ensure user has a credits record (insert if not exists)
  INSERT INTO public.credits (user_id, amount, created_at, updated_at)
  VALUES (p_user_id, 0, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock the row and get current balance
  SELECT amount INTO v_current_balance
  FROM public.credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;

  -- Check for insufficient credits (only for debits)
  IF p_amount < 0 AND v_new_balance < 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'current_balance', v_current_balance,
      'required', ABS(p_amount),
      'new_balance', NULL,
      'transaction_id', NULL
    );
  END IF;

  -- Update credits
  UPDATE public.credits
  SET 
    amount = v_new_balance,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log transaction
  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    type,
    description,
    metadata,
    generation_id,
    created_at
  )
  VALUES (
    p_user_id,
    p_amount,
    p_type,
    p_description,
    p_metadata,
    p_generation_id,
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id,
    'error', NULL
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'new_balance', NULL,
      'transaction_id', NULL
    );
END;
$$;

-- ============================================
-- 5. Helper Function: get_user_balance
-- ============================================
-- Quick way to get user balance

CREATE OR REPLACE FUNCTION public.get_user_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT amount INTO v_balance
  FROM public.credits
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    -- Auto-create with 0 balance
    INSERT INTO public.credits (user_id, amount)
    VALUES (p_user_id, 0)
    RETURNING amount INTO v_balance;
  END IF;
  
  RETURN COALESCE(v_balance, 0);
END;
$$;

-- ============================================
-- 6. Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own data

-- Credits policies
DROP POLICY IF EXISTS "Users can read own credits" ON public.credits;
CREATE POLICY "Users can read own credits"
  ON public.credits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Credit transactions policies
DROP POLICY IF EXISTS "Users can read own transactions" ON public.credit_transactions;
CREATE POLICY "Users can read own transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Generations policies
DROP POLICY IF EXISTS "Users can read own generations" ON public.generations;
CREATE POLICY "Users can read own generations"
  ON public.generations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own generations" ON public.generations;
CREATE POLICY "Users can insert own generations"
  ON public.generations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own generations" ON public.generations;
CREATE POLICY "Users can update own generations"
  ON public.generations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 7. Storage Bucket & Policies
-- ============================================

-- Create generations bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generations',
  'generations',
  true,
  52428800, -- 50MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'video/mp4']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies
DROP POLICY IF EXISTS "Public read generations" ON storage.objects;
CREATE POLICY "Public read generations"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'generations');

DROP POLICY IF EXISTS "Users upload own generations" ON storage.objects;
CREATE POLICY "Users upload own generations"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'generations' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own generations" ON storage.objects;
CREATE POLICY "Users update own generations"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'generations' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================
-- 8. Triggers for updated_at
-- ============================================

-- Credits updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_credits_updated_at ON public.credits;
CREATE TRIGGER update_credits_updated_at
  BEFORE UPDATE ON public.credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_generations_updated_at ON public.generations;
CREATE TRIGGER update_generations_updated_at
  BEFORE UPDATE ON public.generations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Migration Complete!
-- ============================================
-- Tables created: credits, credit_transactions, generations
-- Functions created: adjust_credits, get_user_balance
-- Storage bucket: generations
-- RLS enabled with policies
-- Triggers: updated_at auto-update

