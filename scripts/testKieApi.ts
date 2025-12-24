#!/usr/bin/env tsx
/**
 * Test KIE_API_KEY requests to /api/infer
 * 
 * Tests that inference works correctly with KIE_API_KEY
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: any;
}

async function testHealth(): Promise<TestResult> {
  console.log("1️⃣ Testing /api/health...\n");
  
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    
    const hasKieKey = data.env?.KIE_API_KEY === true;
    const supabaseOptional = data.env?.INFER_SUPABASE_OPTIONAL === true;
    
    console.log(`   Status: ${data.status}`);
    console.log(`   KIE_API_KEY: ${hasKieKey ? "✅ Configured" : "❌ Missing"}`);
    console.log(`   Supabase configured: ${data.supabase?.configured ? "✅" : "❌"}`);
    console.log(`   Supabase reachable: ${data.supabase?.reachable ? "✅" : "⚠️  Not reachable"}`);
    console.log(`   INFER_SUPABASE_OPTIONAL: ${supabaseOptional ? "✅ (MVP mode)" : "❌ (Strict mode)"}`);
    
    if (data.supabase?.error) {
      console.log(`   Supabase error: ${data.supabase.error}`);
    }
    
    return {
      name: "Health Check",
      success: res.ok,
      details: data,
    };
  } catch (error) {
    return {
      name: "Health Check",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testInference(modelId: string, prompt: string, imageUrl?: string): Promise<TestResult> {
  console.log(`\n2️⃣ Testing /api/infer with ${modelId}...\n`);
  console.log(`   Prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? "..." : ""}"`);
  
  const payload: any = {
    modelId,
    inputs: {
      prompt,
    },
    params: {},
    outputsCount: 1,
  };
  
  if (imageUrl) {
    payload.inputs.imageUrl = imageUrl;
    console.log(`   Image URL: ${imageUrl.substring(0, 50)}...`);
  }
  
  try {
    const startTime = Date.now();
    const res = await fetch(`${BASE_URL}/api/infer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    const duration = Date.now() - startTime;
    const result = await res.json();
    
    console.log(`   HTTP Status: ${res.status}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Success: ${result.success ? "✅" : "❌"}`);
    
    if (result.success) {
      if (result.urls && result.urls.length > 0) {
        console.log(`   URLs returned: ${result.urls.length}`);
        result.urls.forEach((url: string, idx: number) => {
          console.log(`     ${idx + 1}. ${url.substring(0, 80)}${url.length > 80 ? "..." : ""}`);
        });
      }
      
      if (result.text) {
        console.log(`   Text output: ${result.text.substring(0, 100)}${result.text.length > 100 ? "..." : ""}`);
      }
      
      if (result.meta) {
        console.log(`   Meta:`);
        console.log(`     - Model: ${result.meta.modelId}`);
        console.log(`     - Provider: ${result.meta.provider || "unknown"}`);
        if (result.meta.taskIds) {
          console.log(`     - Task IDs: ${result.meta.taskIds.length}`);
        }
        if (result.meta.duration) {
          console.log(`     - Duration: ${result.meta.duration}ms`);
        }
        if (result.meta.supabase === "skipped") {
          console.log(`     - ⚠️  Supabase skipped: ${result.meta.reason || "unknown"}`);
        }
      }
      
      if (result.newBalance !== undefined) {
        console.log(`   New Balance: ${result.newBalance}`);
      } else {
        console.log(`   Balance: N/A (fallback mode or no auth)`);
      }
      
      return {
        name: `Inference: ${modelId}`,
        success: true,
        details: {
          urls: result.urls?.length || 0,
          text: result.text ? result.text.length : 0,
          meta: result.meta,
        },
      };
    } else {
      console.log(`   ❌ Error: ${result.error || "Unknown error"}`);
      return {
        name: `Inference: ${modelId}`,
        success: false,
        error: result.error || "Unknown error",
        details: result,
      };
    }
  } catch (error) {
    return {
      name: `Inference: ${modelId}`,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runTests() {
  console.log("🧪 Testing KIE_API_KEY Integration\n");
  console.log(`Base URL: ${BASE_URL}\n`);
  console.log("=" .repeat(60) + "\n");
  
  const results: TestResult[] = [];
  
  // Test 1: Health check
  const healthResult = await testHealth();
  results.push(healthResult);
  
  if (!healthResult.success) {
    console.log("\n❌ Health check failed. Cannot proceed with inference tests.");
    return results;
  }
  
  // Test 2: Seedream image generation
  const seedreamResult = await testInference(
    "seedream_image",
    "a beautiful sunset over mountains, cinematic lighting, 4k"
  );
  results.push(seedreamResult);
  
  // Test 3: Anthropic text (if available)
  if (healthResult.details?.env?.ANTHROPIC_API_KEY) {
    const anthropicResult = await testInference(
      "anthropic_text",
      "Write a short haiku about coding"
    );
    results.push(anthropicResult);
  } else {
    console.log("\n⏭️  Skipping Anthropic test (ANTHROPIC_API_KEY not configured)");
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Test Summary:\n");
  
  results.forEach((result, idx) => {
    const icon = result.success ? "✅" : "❌";
    console.log(`${idx + 1}. ${icon} ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`\n${successCount}/${totalCount} tests passed`);
  
  if (successCount === totalCount) {
    console.log("\n🎉 All tests PASSED!");
    return results;
  } else {
    console.log("\n⚠️  Some tests failed");
    return results;
  }
}

// Run tests
runTests()
  .then((results) => {
    const allPassed = results.every(r => r.success);
    process.exit(allPassed ? 0 : 1);
  })
  .catch((error) => {
    console.error("\n❌ Test runner error:", error);
    process.exit(1);
  });

