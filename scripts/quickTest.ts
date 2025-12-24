/**
 * Quick Supabase Test
 * Tests credits operations directly
 */

import { createClient } from "@supabase/supabase-js";

// Load env from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✓ ${message}`, colors.green);
}

function error(message: string) {
  log(`✗ ${message}`, colors.red);
}

function info(message: string) {
  log(`${message}`, colors.blue);
}

async function main() {
  log("\n========================================", colors.cyan);
  log("  Quick Supabase Test", colors.cyan);
  log("========================================\n", colors.cyan);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testUserId = process.env.TEST_USER_ID || "00000000-0000-0000-0000-000000000000";

  if (!supabaseUrl || !serviceRoleKey) {
    error("Missing env variables. Check .env.local");
    process.exit(1);
  }

  info(`Using test user: ${testUserId}`);
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Test 1: Get initial balance
  info("\n1️⃣ Getting initial balance...");
  const { data: balance1, error: balanceError1 } = await supabase.rpc("get_user_balance", {
    p_user_id: testUserId,
  });

  if (balanceError1) {
    error(`get_user_balance() failed: ${balanceError1.message}`);
    process.exit(1);
  }

  success(`Initial balance: ${balance1}`);

  // Test 2: Add 10 credits
  info("\n2️⃣ Adding +10 credits...");
  const { data: result1, error: addError } = await supabase.rpc("adjust_credits", {
    p_user_id: testUserId,
    p_amount: 10,
    p_type: "test",
    p_description: "Quick test: add 10 credits",
    p_generation_id: null,
    p_metadata: { test: true },
  });

  if (addError) {
    error(`adjust_credits(+10) failed: ${addError.message}`);
    process.exit(1);
  }

  console.log("Raw result:", JSON.stringify(result1, null, 2));
  
  const addResult = result1 as { success: boolean; new_balance: number };
  if (!addResult.success) {
    error(`Failed to add credits: ${JSON.stringify(addResult)}`);
    process.exit(1);
  }

  success(`Added +10 credits. New balance: ${addResult.new_balance}`);

  // Test 3: Deduct 5 credits
  info("\n3️⃣ Deducting -5 credits...");
  const { data: result2, error: deductError } = await supabase.rpc("adjust_credits", {
    p_user_id: testUserId,
    p_amount: -5,
    p_type: "test",
    p_description: "Quick test: deduct 5 credits",
    p_generation_id: null,
    p_metadata: { test: true },
  });

  if (deductError) {
    error(`adjust_credits(-5) failed: ${deductError.message}`);
    process.exit(1);
  }

  const deductResult = result2 as { success: boolean; new_balance: number };
  if (!deductResult.success) {
    error("Failed to deduct credits");
    process.exit(1);
  }

  success(`Deducted -5 credits. New balance: ${deductResult.new_balance}`);

  // Test 4: Try to deduct more than available (should fail gracefully)
  info("\n4️⃣ Testing insufficient credits (deduct -1000000)...");
  const { data: result3, error: insufficientError } = await supabase.rpc("adjust_credits", {
    p_user_id: testUserId,
    p_amount: -1000000,
    p_type: "test",
    p_description: "Should fail",
    p_generation_id: null,
    p_metadata: { test: true },
  });

  if (insufficientError) {
    error(`RPC error: ${insufficientError.message}`);
    process.exit(1);
  }

  const insufficientResult = result3 as { success: boolean; error?: string; new_balance?: number };
  if (insufficientResult.success) {
    error("ERROR: Should have failed due to insufficient credits!");
    process.exit(1);
  }

  success(`Correctly rejected: ${insufficientResult.error}`);

  // Test 5: Get final balance
  info("\n5️⃣ Getting final balance...");
  const { data: balance2, error: balanceError2 } = await supabase.rpc("get_user_balance", {
    p_user_id: testUserId,
  });

  if (balanceError2) {
    error(`get_user_balance() failed: ${balanceError2.message}`);
    process.exit(1);
  }

  success(`Final balance: ${balance2}`);

  // Test 6: Check transactions
  info("\n6️⃣ Checking transaction history...");
  const { data: transactions, error: txError } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", testUserId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (txError) {
    error(`Failed to get transactions: ${txError.message}`);
    process.exit(1);
  }

  success(`Found ${transactions?.length || 0} recent transactions`);
  if (transactions && transactions.length > 0) {
    transactions.forEach((tx: any, i: number) => {
      info(`  ${i + 1}. ${tx.amount > 0 ? '+' : ''}${tx.amount} credits - ${tx.description || tx.type}`);
    });
  }

  // Summary
  log("\n========================================", colors.cyan);
  log("  ALL TESTS PASSED! ✓", colors.green);
  log("========================================\n", colors.cyan);

  info("Summary:");
  info(`  • Initial balance: ${balance1}`);
  info(`  • After +10: ${addResult.new_balance}`);
  info(`  • After -5: ${deductResult.new_balance}`);
  info(`  • Final balance: ${balance2}`);
  info(`  • Transactions logged: ${transactions?.length || 0}`);
  
  log("\n✅ Supabase credits system is working correctly!", colors.green);
}

main().catch((err) => {
  error(`\nUnexpected error: ${err instanceof Error ? err.message : String(err)}`);
  console.error(err);
  process.exit(1);
});

