#!/usr/bin/env tsx
/**
 * Smoke test for Supabase fallback mode
 * 
 * Tests that /api/infer works without Supabase env vars when
 * INFER_SUPABASE_OPTIONAL=true
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function smokeTest() {
  console.log("🧪 Smoke Test: Supabase Fallback Mode\n");
  console.log(`Testing: ${BASE_URL}\n`);

  // Test 1: Health check
  console.log("1️⃣ Testing /api/health...");
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const health = await healthRes.json();
    
    console.log(`   Status: ${health.status}`);
    console.log(`   KIE_API_KEY: ${health.env.KIE_API_KEY ? "✅" : "❌"}`);
    console.log(`   Supabase configured: ${health.supabase.configured ? "✅" : "❌"}`);
    console.log(`   Supabase reachable: ${health.supabase.reachable ? "✅" : "❌"}`);
    console.log(`   INFER_SUPABASE_OPTIONAL: ${health.env.INFER_SUPABASE_OPTIONAL ? "✅" : "❌"}`);
    
    if (!health.env.KIE_API_KEY && !health.env.USE_MOCK_INFERENCE) {
      console.log("   ⚠️  KIE_API_KEY not configured - inference will fail");
    }
  } catch (error) {
    console.error("   ❌ Health check failed:", error);
    return false;
  }

  // Test 2: Inference without Supabase (if INFER_SUPABASE_OPTIONAL=true)
  console.log("\n2️⃣ Testing /api/infer (fallback mode)...");
  
  const testPayload = {
    modelId: "seedream_image",
    inputs: {
      prompt: "a beautiful sunset over mountains",
    },
    params: {},
    outputsCount: 1,
  };

  try {
    const inferRes = await fetch(`${BASE_URL}/api/infer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });

    const result = await inferRes.json();

    if (inferRes.ok && result.success) {
      console.log("   ✅ Inference succeeded!");
      console.log(`   URLs: ${result.urls?.length || 0} returned`);
      
      if (result.meta?.supabase === "skipped") {
        console.log(`   ⚠️  Supabase skipped: ${result.meta.reason || "unknown"}`);
        console.log("   ✅ Fallback mode working correctly!");
      } else {
        console.log("   ✅ Full Supabase mode (credits/generations tracked)");
      }
      
      if (result.newBalance !== undefined) {
        console.log(`   Balance: ${result.newBalance}`);
      } else {
        console.log("   Balance: N/A (fallback mode)");
      }
      
      return true;
    } else {
      console.error("   ❌ Inference failed:");
      console.error(`   Error: ${result.error || "Unknown"}`);
      console.error(`   Status: ${inferRes.status}`);
      return false;
    }
  } catch (error) {
    console.error("   ❌ Request failed:", error);
    return false;
  }
}

// Run test
smokeTest()
  .then((success) => {
    if (success) {
      console.log("\n✅ Smoke test PASSED");
      process.exit(0);
    } else {
      console.log("\n❌ Smoke test FAILED");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("\n❌ Smoke test ERROR:", error);
    process.exit(1);
  });

