/**
 * Supabase Smoke Test
 * 
 * Verifies that Supabase setup is correct:
 * - Database tables exist
 * - RPC functions work
 * - Storage bucket is accessible
 * 
 * Usage:
 *   npm run db:smoke
 * 
 * Required ENV:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - TEST_USER_ID (UUID of test user)
 */

import { createClient } from "@supabase/supabase-js";

// Colors for output
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
  log(`ℹ ${message}`, colors.blue);
}

function warn(message: string) {
  log(`⚠ ${message}`, colors.yellow);
}

async function main() {
  log("\n========================================", colors.cyan);
  log("  Supabase Smoke Test", colors.cyan);
  log("========================================\n", colors.cyan);

  // 1. Check environment variables
  info("Step 1: Checking environment variables...");
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testUserId = process.env.TEST_USER_ID || "00000000-0000-0000-0000-000000000000";
  const bucketName = process.env.BUCKET_NAME || "generations";

  if (!supabaseUrl) {
    error("NEXT_PUBLIC_SUPABASE_URL is not set");
    process.exit(1);
  }
  success(`NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}`);

  if (!serviceRoleKey) {
    error("SUPABASE_SERVICE_ROLE_KEY is not set");
    process.exit(1);
  }
  success("SUPABASE_SERVICE_ROLE_KEY: ***");

  warn(`TEST_USER_ID: ${testUserId} (using default if not set)`);
  
  // 2. Create Supabase client
  info("\nStep 2: Creating Supabase admin client...");
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  success("Supabase client created");

  // 3. Test database tables
  info("\nStep 3: Testing database tables...");
  
  const tables = ["credits", "credit_transactions", "generations"];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("id")
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      success(`Table '${table}' exists and is accessible`);
    } catch (err) {
      error(`Table '${table}' error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  // 4. Test RPC functions
  info("\nStep 4: Testing RPC functions...");
  
  // Test get_user_balance
  try {
    const { data, error } = await supabase.rpc("get_user_balance", {
      p_user_id: testUserId,
    });
    
    if (error) {
      throw error;
    }
    
    const balance = data as number;
    success(`get_user_balance() works (current: ${balance})`);
  } catch (err) {
    error(`get_user_balance() error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Test adjust_credits (add credits)
  try {
    const { data, error } = await supabase.rpc("adjust_credits", {
      p_user_id: testUserId,
      p_amount: 1,
      p_type: "test",
      p_description: "Smoke test: add 1 credit",
      p_generation_id: null,
      p_metadata: { test: true },
    });
    
    if (error) {
      throw error;
    }
    
    const result = data as { success: boolean; new_balance: number; transaction_id: string };
    
    if (!result.success) {
      throw new Error("adjust_credits returned success=false");
    }
    
    success(`adjust_credits(+1) works (new balance: ${result.new_balance})`);
  } catch (err) {
    error(`adjust_credits(+1) error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Test adjust_credits (deduct credits)
  try {
    const { data, error } = await supabase.rpc("adjust_credits", {
      p_user_id: testUserId,
      p_amount: -1,
      p_type: "test",
      p_description: "Smoke test: deduct 1 credit",
      p_generation_id: null,
      p_metadata: { test: true },
    });
    
    if (error) {
      throw error;
    }
    
    const result = data as { success: boolean; new_balance: number; transaction_id: string };
    
    if (!result.success) {
      throw new Error("adjust_credits returned success=false");
    }
    
    success(`adjust_credits(-1) works (new balance: ${result.new_balance})`);
  } catch (err) {
    error(`adjust_credits(-1) error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // 5. Test Storage
  info("\nStep 5: Testing Supabase Storage...");
  
  // Check if bucket exists
  try {
    const { data, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      throw bucketError;
    }
    
    const bucket = data.find((b) => b.id === bucketName);
    
    if (!bucket) {
      error(`Storage bucket '${bucketName}' not found`);
      warn("Run SQL migration to create the bucket");
      process.exit(1);
    }
    
    success(`Storage bucket '${bucketName}' exists`);
  } catch (err) {
    error(`Storage bucket check error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Upload test file
  try {
    const testFilePath = `${testUserId}/photo/smoke_test.png`;
    
    // Create a minimal 1x1 PNG
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(testFilePath, pngBuffer, {
        contentType: "image/png",
        upsert: true,
      });
    
    if (uploadError) {
      throw uploadError;
    }
    
    success(`Test file uploaded: ${uploadData.path}`);
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(testFilePath);
    
    if (!urlData?.publicUrl) {
      throw new Error("Failed to get public URL");
    }
    
    success(`Public URL: ${urlData.publicUrl}`);
    
    // Clean up
    const { error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove([testFilePath]);
    
    if (deleteError) {
      warn(`Failed to clean up test file: ${deleteError.message}`);
    } else {
      success("Test file cleaned up");
    }
  } catch (err) {
    error(`Storage upload error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // 6. Test generations table operations
  info("\nStep 6: Testing generations table operations...");
  
  const testGenerationId = crypto.randomUUID();
  
  try {
    // Insert test generation
    const { error: insertError } = await supabase
      .from("generations")
      .insert({
        id: testGenerationId,
        user_id: testUserId,
        type: "photo",
        model: "test_model",
        prompt: "Smoke test generation",
        status: "processing",
        credits_used: 0,
        metadata: { test: true },
      });
    
    if (insertError) {
      throw insertError;
    }
    
    success(`Test generation created: ${testGenerationId}`);
    
    // Update generation to success
    const { error: updateError } = await supabase
      .from("generations")
      .update({
        status: "success",
        result_urls: ["https://example.com/test.png"],
      })
      .eq("id", testGenerationId);
    
    if (updateError) {
      throw updateError;
    }
    
    success("Test generation updated to success");
    
    // Read generation
    const { data: generation, error: readError } = await supabase
      .from("generations")
      .select("*")
      .eq("id", testGenerationId)
      .single();
    
    if (readError) {
      throw readError;
    }
    
    if (generation.status !== "success") {
      throw new Error("Generation status not updated correctly");
    }
    
    success("Test generation read successfully");
    
    // Clean up
    const { error: deleteError } = await supabase
      .from("generations")
      .delete()
      .eq("id", testGenerationId);
    
    if (deleteError) {
      warn(`Failed to clean up test generation: ${deleteError.message}`);
    } else {
      success("Test generation cleaned up");
    }
  } catch (err) {
    error(`Generations table error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Summary
  log("\n========================================", colors.cyan);
  log("  ALL TESTS PASSED! ✓", colors.green);
  log("========================================\n", colors.cyan);
  
  info("Your Supabase setup is ready for production!");
  info("Next steps:");
  info("  1. Set TEST_USER_ID to a real user UUID");
  info("  2. Test /api/infer endpoint");
  info("  3. Check generations in Supabase dashboard");
}

main().catch((err) => {
  error(`\nUnexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

