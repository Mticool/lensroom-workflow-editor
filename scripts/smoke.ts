#!/usr/bin/env node
/**
 * Smoke Test for Vercel Deployment
 * 
 * Tests that the app is ready for deployment:
 * - ENV variables are set
 * - /api/models returns models
 * - /api/infer works in mock mode
 * - /api/infer works in real mode (with TEST_USER_ID)
 * 
 * Usage:
 *   npm run smoke
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

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
  log(`✅ ${message}`, colors.green);
}

function fail(message: string) {
  log(`❌ ${message}`, colors.red);
}

function warn(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

async function main() {
  log("\n" + "═".repeat(70), colors.cyan);
  log("  Smoke Test - Vercel Deployment Readiness", colors.cyan);
  log("═".repeat(70) + "\n", colors.cyan);

  let hasErrors = false;

  // 1. Check ENV variables
  info("Step 1: Checking environment variables...\n");

  const requiredVars = [
    "KIE_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      success(`${varName} is set`);
    } else {
      fail(`${varName} is missing`);
      hasErrors = true;
    }
  }

  // Check TEST_MODE
  const testMode = process.env.TEST_MODE === "true";
  const testUserId = process.env.TEST_USER_ID;

  console.log();
  if (testMode) {
    info(`TEST_MODE is enabled`);
    if (testUserId) {
      success(`TEST_USER_ID is set: ${testUserId}`);
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(testUserId)) {
        success(`TEST_USER_ID is valid UUID`);
      } else {
        fail(`TEST_USER_ID is not a valid UUID`);
        hasErrors = true;
      }
    } else {
      fail(`TEST_MODE is true but TEST_USER_ID is not set`);
      hasErrors = true;
    }
  } else {
    warn(`TEST_MODE is disabled (normal auth will be used)`);
  }

  if (hasErrors) {
    console.log();
    fail("Environment check failed. Fix errors and try again.");
    process.exit(1);
  }

  // 2. Test /api/models
  info("\nStep 2: Testing /api/models...\n");

  try {
    const modelsResponse = await fetch("http://localhost:3000/api/models");
    
    if (!modelsResponse.ok) {
      fail(`/api/models returned ${modelsResponse.status}`);
      hasErrors = true;
    } else {
      const models = await modelsResponse.json();
      
      if (Array.isArray(models) && models.length > 0) {
        success(`/api/models returned ${models.length} models`);
        
        // Check for expected models
        const expectedModels = ["seedream_image", "nano_banana_edit", "veo3_video"];
        for (const modelId of expectedModels) {
          const model = models.find((m: any) => m.id === modelId);
          if (model && model.enabled) {
            success(`  ✓ ${modelId} is enabled`);
          } else {
            warn(`  ⚠️  ${modelId} not found or disabled`);
          }
        }
      } else {
        fail(`/api/models returned invalid data`);
        hasErrors = true;
      }
    }
  } catch (error) {
    fail(`/api/models request failed: ${error instanceof Error ? error.message : String(error)}`);
    fail(`Make sure dev server is running: npm run dev`);
    hasErrors = true;
  }

  // 3. Test /api/infer (mock mode)
  info("\nStep 3: Testing /api/infer (MOCK mode)...\n");

  try {
    // Temporarily set USE_MOCK_INFERENCE
    const originalMock = process.env.USE_MOCK_INFERENCE;
    process.env.USE_MOCK_INFERENCE = "true";

    const mockResponse = await fetch("http://localhost:3000/api/infer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        modelId: "seedream_image",
        inputs: {
          prompt: "smoke test image",
        },
        params: {},
      }),
    });

    process.env.USE_MOCK_INFERENCE = originalMock;

    if (!mockResponse.ok) {
      fail(`/api/infer (mock) returned ${mockResponse.status}`);
      const errorData = await mockResponse.json();
      fail(`Error: ${errorData.error || "Unknown"}`);
      hasErrors = true;
    } else {
      const data = await mockResponse.json();
      
      if (data.success && data.urls && data.urls.length > 0) {
        success(`/api/infer (mock) returned URL: ${data.urls[0]}`);
        if (data.meta?.mock) {
          success(`  ✓ Mock mode confirmed`);
        }
      } else {
        fail(`/api/infer (mock) returned invalid data`);
        hasErrors = true;
      }
    }
  } catch (error) {
    fail(`/api/infer (mock) request failed: ${error instanceof Error ? error.message : String(error)}`);
    hasErrors = true;
  }

  // 4. Test /api/infer (real mode) - Only if TEST_MODE is enabled
  if (testMode && testUserId) {
    info("\nStep 4: Testing /api/infer (REAL mode with TEST_USER_ID)...\n");
    info("⏳ This will take ~10-20 seconds (real Kie.ai call)...\n");

    try {
      const realResponse = await fetch("http://localhost:3000/api/infer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelId: "seedream_image",
          inputs: {
            prompt: "a cute robot waving hello",
          },
          params: {},
        }),
      });

      if (!realResponse.ok) {
        fail(`/api/infer (real) returned ${realResponse.status}`);
        const errorData = await realResponse.json();
        fail(`Error: ${errorData.error || "Unknown"}`);
        
        if (realResponse.status === 401) {
          fail(`Authentication failed. Check TEST_USER_ID exists in database.`);
        } else if (realResponse.status === 402) {
          fail(`Insufficient credits. Add credits to TEST_USER_ID.`);
        }
        
        hasErrors = true;
      } else {
        const data = await realResponse.json();
        
        if (data.success && data.urls && data.urls.length > 0) {
          success(`/api/infer (real) returned URL: ${data.urls[0]}`);
          success(`  ✓ Generation ID: ${data.meta?.generationId}`);
          success(`  ✓ Task ID: ${data.meta?.taskId}`);
          success(`  ✓ Duration: ${data.meta?.duration}ms`);
          success(`  ✓ New balance: ${data.newBalance}`);
        } else {
          fail(`/api/infer (real) returned invalid data`);
          hasErrors = true;
        }
      }
    } catch (error) {
      fail(`/api/infer (real) request failed: ${error instanceof Error ? error.message : String(error)}`);
      hasErrors = true;
    }
  } else {
    info("\nStep 4: Skipping real inference test (TEST_MODE not enabled)\n");
    warn("To test real inference, set TEST_MODE=true and TEST_USER_ID in .env.local");
  }

  // Summary
  console.log();
  log("═".repeat(70), colors.cyan);
  
  if (hasErrors) {
    fail("  ❌ SMOKE TEST FAILED");
    log("═".repeat(70), colors.cyan);
    process.exit(1);
  } else {
    success("  ✅ ALL TESTS PASSED!");
    log("═".repeat(70), colors.cyan);
    console.log();
    success("App is ready for Vercel deployment! 🚀");
    console.log();
    info("Next steps:");
    info("  1. Commit changes: git add . && git commit -m 'Ready for deployment'");
    info("  2. Push to GitHub: git push");
    info("  3. Deploy to Vercel");
    info("  4. Set environment variables in Vercel dashboard");
    process.exit(0);
  }
}

main().catch((err) => {
  fail(`\nUnexpected error: ${err instanceof Error ? err.message : String(err)}`);
  console.error(err);
  process.exit(1);
});
