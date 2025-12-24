#!/usr/bin/env node
/**
 * SQL Generator for Supabase
 * 
 * Generates ready-to-paste SQL commands for credit top-ups
 * 
 * Usage:
 *   npm run sql:topup:tg -- --telegram 250474388 --amount 100
 *   npm run sql:topup:user -- --user 1a13c194-06ce-4d18-8b36-b9eaf0a5d5d3 --amount 100
 */

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function box(title: string, content: string) {
  const width = 70;
  const border = "═".repeat(width);
  
  log(`\n╔${border}╗`, colors.cyan);
  log(`║ ${title.padEnd(width - 1)}║`, colors.cyan);
  log(`╠${border}╣`, colors.cyan);
  log(content, colors.bright);
  log(`╚${border}╝`, colors.cyan);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: { telegram?: number; user?: string; amount?: number } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if ((arg === "--telegram" || arg === "-t") && nextArg) {
      parsed.telegram = parseInt(nextArg, 10);
      i++;
    } else if ((arg === "--user" || arg === "-u") && nextArg) {
      parsed.user = nextArg;
      i++;
    } else if ((arg === "--amount" || arg === "-a") && nextArg) {
      parsed.amount = parseInt(nextArg, 10);
      i++;
    }
  }

  return parsed;
}

function generateTelegramLookupSql(telegramId: number, amount: number): string {
  return `-- ═══════════════════════════════════════════════════════════════════
-- Step 1: Find auth_user_id from Telegram ID
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  telegram_id,
  auth_user_id,
  username,
  first_name
FROM public.telegram_profiles 
WHERE telegram_id = ${telegramId};

-- ═══════════════════════════════════════════════════════════════════
-- Step 2: Copy the auth_user_id from above and run this:
-- ═══════════════════════════════════════════════════════════════════

-- Replace <AUTH_USER_ID> with the UUID from Step 1
SELECT * FROM public.adjust_credits(
  p_user_id := '<AUTH_USER_ID>'::uuid,
  p_amount := ${amount},
  p_type := 'bonus',
  p_description := 'Manual top-up for telegram_id=${telegramId}',
  p_generation_id := NULL,
  p_metadata := jsonb_build_object(
    'telegram_id', ${telegramId},
    'method', 'manual_script'
  )
);

-- ═══════════════════════════════════════════════════════════════════
-- Or run both steps in one go (if you know the user exists):
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  -- Get auth_user_id
  SELECT auth_user_id INTO v_user_id
  FROM public.telegram_profiles
  WHERE telegram_id = ${telegramId};
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with telegram_id=${telegramId} not found';
  END IF;
  
  -- Adjust credits
  SELECT * INTO v_result
  FROM public.adjust_credits(
    p_user_id := v_user_id,
    p_amount := ${amount},
    p_type := 'bonus',
    p_description := 'Manual top-up for telegram_id=${telegramId}',
    p_generation_id := NULL,
    p_metadata := jsonb_build_object(
      'telegram_id', ${telegramId},
      'method', 'manual_script'
    )
  );
  
  RAISE NOTICE 'Result: %', v_result;
END $$;`;
}

function generateUserTopupSql(userId: string, amount: number): string {
  return `-- ═══════════════════════════════════════════════════════════════════
-- Top-up ${amount} credits for user ${userId}
-- ═══════════════════════════════════════════════════════════════════

SELECT * FROM public.adjust_credits(
  p_user_id := '${userId}'::uuid,
  p_amount := ${amount},
  p_type := 'bonus',
  p_description := 'Manual top-up via script',
  p_generation_id := NULL,
  p_metadata := jsonb_build_object(
    'method', 'manual_script',
    'timestamp', NOW()
  )
);

-- ═══════════════════════════════════════════════════════════════════
-- Verify new balance:
-- ═══════════════════════════════════════════════════════════════════

SELECT * FROM public.get_user_balance('${userId}'::uuid);

-- ═══════════════════════════════════════════════════════════════════
-- View recent transactions:
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  created_at,
  amount,
  type,
  description,
  metadata
FROM public.credit_transactions
WHERE user_id = '${userId}'::uuid
ORDER BY created_at DESC
LIMIT 5;`;
}

function main() {
  log("\n" + "═".repeat(70), colors.cyan);
  log("  SQL Generator for Supabase Credit Top-ups", colors.bright);
  log("═".repeat(70) + "\n", colors.cyan);

  const args = parseArgs();

  // Validate arguments
  if (!args.amount) {
    log("❌ Error: --amount is required\n", colors.yellow);
    log("Usage:", colors.bright);
    log("  By Telegram ID:", colors.gray);
    log("    npm run sql:topup:tg -- --telegram 250474388 --amount 100\n", colors.green);
    log("  By User ID:", colors.gray);
    log("    npm run sql:topup:user -- --user 1a13c194-06ce-4d18-8b36-b9eaf0a5d5d3 --amount 100\n", colors.green);
    process.exit(1);
  }

  if (!args.telegram && !args.user) {
    log("❌ Error: Either --telegram or --user is required\n", colors.yellow);
    log("Usage:", colors.bright);
    log("  npm run sql:topup:tg -- --telegram 250474388 --amount 100", colors.green);
    log("  npm run sql:topup:user -- --user <uuid> --amount 100\n", colors.green);
    process.exit(1);
  }

  if (args.telegram && args.user) {
    log("❌ Error: Use either --telegram or --user, not both\n", colors.yellow);
    process.exit(1);
  }

  // Generate SQL
  let sql: string;
  let mode: string;

  if (args.user) {
    mode = "Direct User Top-up";
    sql = generateUserTopupSql(args.user, args.amount);
    
    log(`📝 Mode: ${mode}`, colors.blue);
    log(`👤 User ID: ${args.user}`, colors.gray);
    log(`💰 Amount: ${args.amount >= 0 ? '+' : ''}${args.amount} credits`, colors.green);
    
  } else if (args.telegram) {
    mode = "Telegram User Lookup + Top-up";
    sql = generateTelegramLookupSql(args.telegram, args.amount);
    
    log(`📝 Mode: ${mode}`, colors.blue);
    log(`📱 Telegram ID: ${args.telegram}`, colors.gray);
    log(`💰 Amount: ${args.amount >= 0 ? '+' : ''}${args.amount} credits`, colors.green);
  } else {
    log("❌ Unexpected error", colors.yellow);
    process.exit(1);
  }

  // Output SQL
  box("📋 COPY THIS SQL TO SUPABASE SQL EDITOR", sql);

  // Instructions
  log("\n" + "─".repeat(70), colors.gray);
  log("📌 Instructions:", colors.bright);
  log("  1. Copy the entire SQL block above", colors.gray);
  log("  2. Open Supabase Dashboard → SQL Editor", colors.gray);
  log("  3. Paste and click 'Run' (or press Cmd/Ctrl + Enter)", colors.gray);
  
  if (args.telegram) {
    log("\n💡 Tip:", colors.yellow);
    log("  If you already know the user_id, use:", colors.gray);
    log(`  npm run sql:topup:user -- --user <uuid> --amount ${args.amount}`, colors.green);
  }
  
  log("\n" + "─".repeat(70) + "\n", colors.gray);
}

main();

