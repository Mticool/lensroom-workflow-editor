-- Fix: Add missing metadata column to credit_transactions
-- Run this in Supabase SQL Editor

-- Check if metadata column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'credit_transactions' 
    AND column_name = 'metadata'
  ) THEN
    -- Add metadata column
    ALTER TABLE public.credit_transactions 
    ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    
    RAISE NOTICE 'Added metadata column to credit_transactions';
  ELSE
    RAISE NOTICE 'metadata column already exists';
  END IF;
END $$;

-- Check if payment_id column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'credit_transactions' 
    AND column_name = 'payment_id'
  ) THEN
    -- Add payment_id column
    ALTER TABLE public.credit_transactions 
    ADD COLUMN payment_id UUID;
    
    RAISE NOTICE 'Added payment_id column to credit_transactions';
  ELSE
    RAISE NOTICE 'payment_id column already exists';
  END IF;
END $$;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'credit_transactions'
ORDER BY ordinal_position;

