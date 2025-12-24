#!/usr/bin/env node
/**
 * Integration Contract Verification
 * 
 * Checks compliance with docs/LENSROOM_INTEGRATION_CONTRACT.md
 * Does NOT connect to network or database - only static code analysis
 * 
 * Usage:
 *   npm run verify:integration
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
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

interface CheckResult {
  passed: boolean;
  message: string;
  details?: string[];
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    
    // Skip common ignored directories
    if (
      file === "node_modules" ||
      file === ".git" ||
      file === ".next" ||
      file === "dist" ||
      file === "build"
    ) {
      return;
    }

    if (statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (
      file.endsWith(".ts") ||
      file.endsWith(".tsx") ||
      file.endsWith(".js") ||
      file.endsWith(".jsx")
    ) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function checkNoAlternativeBalanceTables(): CheckResult {
  const srcDir = join(process.cwd(), "src");
  const files = getAllFiles(srcDir);
  const violations: string[] = [];

  // Forbidden patterns
  const forbiddenPatterns = [
    /public\.users.*credits/i,
    /CREATE\s+TABLE.*users.*credits/i,
    /from\(['"]users['"]\).*credits/i,
    /\.from\(['"]users['"]\).*\.select\(['"].*credits.*['"]\)/i,
  ];

  files.forEach((file) => {
    try {
      const content = readFileSync(file, "utf-8");

      forbiddenPatterns.forEach((pattern) => {
        if (pattern.test(content)) {
          violations.push(`${file}: Found potential alternative balance table (public.users with credits)`);
        }
      });
    } catch (error) {
      // Skip unreadable files
    }
  });

  if (violations.length === 0) {
    return {
      passed: true,
      message: "No alternative balance tables found",
    };
  }

  return {
    passed: false,
    message: "Found potential alternative balance tables",
    details: violations,
  };
}

function checkAdjustCreditsUsage(): CheckResult {
  const inferRoute = join(process.cwd(), "src/app/api/infer/route.ts");
  
  try {
    const content = readFileSync(inferRoute, "utf-8");

    // Check for adjust_credits usage
    if (!content.includes("adjustCredits")) {
      return {
        passed: false,
        message: "/api/infer does not use adjustCredits()",
        details: ["File: src/app/api/infer/route.ts must call adjustCredits()"],
      };
    }

    // Check for forbidden direct updates
    const forbiddenPatterns = [
      /\.update\(\s*{\s*credits:/i,
      /\.update\(\s*{\s*amount:/i,
      /UPDATE\s+credits\s+SET/i,
      /UPDATE\s+public\.credits/i,
    ];

    const violations: string[] = [];
    forbiddenPatterns.forEach((pattern) => {
      if (pattern.test(content)) {
        violations.push("Found direct UPDATE on credits table (should use adjustCredits instead)");
      }
    });

    if (violations.length > 0) {
      return {
        passed: false,
        message: "Found direct credits manipulation",
        details: violations,
      };
    }

    return {
      passed: true,
      message: "/api/infer correctly uses adjustCredits()",
    };
  } catch (error) {
    return {
      passed: false,
      message: "Could not read /api/infer route",
      details: ["File: src/app/api/infer/route.ts not found"],
    };
  }
}

function checkStorageBucket(): CheckResult {
  const storageFile = join(process.cwd(), "src/lib/storage/upload.ts");
  
  try {
    const content = readFileSync(storageFile, "utf-8");

    // Check for correct bucket name
    if (!content.includes('"generations"') && !content.includes("'generations'")) {
      return {
        passed: false,
        message: 'Storage does not use bucket "generations"',
        details: ['File: src/lib/storage/upload.ts must use bucket "generations"'],
      };
    }

    // Check for forbidden buckets
    const forbiddenBuckets = ["files", "uploads", "images", "media"];
    const violations: string[] = [];

    forbiddenBuckets.forEach((bucket) => {
      if (content.includes(`"${bucket}"`) || content.includes(`'${bucket}'`)) {
        violations.push(`Found reference to forbidden bucket: ${bucket}`);
      }
    });

    if (violations.length > 0) {
      return {
        passed: false,
        message: "Found incorrect bucket names",
        details: violations,
      };
    }

    return {
      passed: true,
      message: 'Storage correctly uses bucket "generations"',
    };
  } catch (error) {
    return {
      passed: false,
      message: "Could not read storage upload file",
      details: ["File: src/lib/storage/upload.ts not found"],
    };
  }
}

function checkAuthUsage(): CheckResult {
  const inferRoute = join(process.cwd(), "src/app/api/infer/route.ts");
  
  try {
    const content = readFileSync(inferRoute, "utf-8");

    // Check for getUserId usage
    if (!content.includes("getUserId")) {
      return {
        passed: false,
        message: "/api/infer does not use getUserId()",
        details: ["File: src/app/api/infer/route.ts must import and use getUserId()"],
      };
    }

    // Check for 401 response
    if (!content.includes("401")) {
      return {
        passed: false,
        message: "/api/infer does not return 401 for unauthorized",
        details: ["Must return 401 status when userId is null"],
      };
    }

    // Check for forbidden patterns (trusting client)
    const forbiddenPatterns = [
      /request\.headers\.get\(['"]x-user-id['"]\)/i,
      /body\.userId/i,
      /params\.userId/i,
    ];

    const violations: string[] = [];
    forbiddenPatterns.forEach((pattern) => {
      if (pattern.test(content)) {
        violations.push("Found potential security issue: trusting client-provided user_id");
      }
    });

    if (violations.length > 0) {
      return {
        passed: false,
        message: "Found auth security issues",
        details: violations,
      };
    }

    return {
      passed: true,
      message: "Auth correctly implemented with getUserId()",
    };
  } catch (error) {
    return {
      passed: false,
      message: "Could not read /api/infer route",
      details: ["File: src/app/api/infer/route.ts not found"],
    };
  }
}

function checkApiKeySecurity(): CheckResult {
  const srcDir = join(process.cwd(), "src");
  const files = getAllFiles(srcDir);
  const violations: string[] = [];

  // Check for exposed secrets
  const forbiddenPatterns = [
    /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/,
    /NEXT_PUBLIC_KIE_API_KEY/,
    /process\.env\.SUPABASE_SERVICE_ROLE_KEY/,
    /process\.env\.KIE_API_KEY/,
  ];

  files.forEach((file) => {
    // Skip server-side files
    if (
      file.includes("/api/") ||
      file.includes("/lib/") ||
      file.includes("server.ts")
    ) {
      return;
    }

    // Only check client components
    if (
      !file.includes("/components/") &&
      !file.includes("/app/") &&
      !file.includes("/pages/")
    ) {
      return;
    }

    try {
      const content = readFileSync(file, "utf-8");

      // Check if it's a client component
      if (content.includes('"use client"') || content.includes("'use client'")) {
        forbiddenPatterns.forEach((pattern, idx) => {
          if (pattern.test(content)) {
            if (idx < 2) {
              violations.push(`${file}: Using NEXT_PUBLIC_ for secret keys`);
            } else {
              violations.push(`${file}: Accessing secret env vars in client component`);
            }
          }
        });
      }
    } catch (error) {
      // Skip unreadable files
    }
  });

  if (violations.length === 0) {
    return {
      passed: true,
      message: "No exposed API keys in client code",
    };
  }

  return {
    passed: false,
    message: "Found potential API key exposure",
    details: violations,
  };
}

function checkGenerationsUsage(): CheckResult {
  const inferRoute = join(process.cwd(), "src/app/api/infer/route.ts");
  
  try {
    const content = readFileSync(inferRoute, "utf-8");

    // Check for generation record creation
    if (!content.includes("createGeneration")) {
      return {
        passed: false,
        message: "/api/infer does not create generation records",
        details: ["Must call createGeneration() before inference"],
      };
    }

    // Check for status updates
    if (
      !content.includes("updateGenerationSuccess") ||
      !content.includes("updateGenerationFailed")
    ) {
      return {
        passed: false,
        message: "/api/infer does not update generation status",
        details: [
          "Must call updateGenerationSuccess() on success",
          "Must call updateGenerationFailed() on error",
        ],
      };
    }

    return {
      passed: true,
      message: "Generation tracking correctly implemented",
    };
  } catch (error) {
    return {
      passed: false,
      message: "Could not read /api/infer route",
      details: ["File: src/app/api/infer/route.ts not found"],
    };
  }
}

function checkModelRegistry(): CheckResult {
  const registryFile = join(process.cwd(), "src/config/modelRegistry.ts");
  const modelsRoute = join(process.cwd(), "src/app/api/models/route.ts");
  
  try {
    // Check registry exists
    const registryContent = readFileSync(registryFile, "utf-8");
    
    if (!registryContent.includes("MODEL_REGISTRY")) {
      return {
        passed: false,
        message: "MODEL_REGISTRY not found",
        details: ["File: src/config/modelRegistry.ts must export MODEL_REGISTRY"],
      };
    }

    // Check /api/models uses registry (directly or via helper)
    const modelsContent = readFileSync(modelsRoute, "utf-8");
    
    if (
      !modelsContent.includes("MODEL_REGISTRY") &&
      !modelsContent.includes("getEnabledModels") &&
      !modelsContent.includes("modelRegistry")
    ) {
      return {
        passed: false,
        message: "/api/models does not use MODEL_REGISTRY",
        details: ["Must import and use MODEL_REGISTRY or getEnabledModels()"],
      };
    }

    return {
      passed: true,
      message: "Model registry correctly configured",
    };
  } catch (error) {
    return {
      passed: false,
      message: "Could not verify model registry",
      details: ["Check if src/config/modelRegistry.ts and src/app/api/models/route.ts exist"],
    };
  }
}

async function main() {
  log("\n" + "═".repeat(70), colors.cyan);
  log("  Integration Contract Verification", colors.bright);
  log("═".repeat(70) + "\n", colors.cyan);

  info("Checking compliance with docs/LENSROOM_INTEGRATION_CONTRACT.md\n");

  const checks = [
    { name: "No Alternative Balance Tables", fn: checkNoAlternativeBalanceTables },
    { name: "adjust_credits() Usage", fn: checkAdjustCreditsUsage },
    { name: "Storage Bucket", fn: checkStorageBucket },
    { name: "Authentication", fn: checkAuthUsage },
    { name: "API Key Security", fn: checkApiKeySecurity },
    { name: "Generations Tracking", fn: checkGenerationsUsage },
    { name: "Model Registry", fn: checkModelRegistry },
  ];

  const results: Array<{ name: string; result: CheckResult }> = [];
  let allPassed = true;

  for (const check of checks) {
    info(`Checking: ${check.name}...`);
    const result = check.fn();
    results.push({ name: check.name, result });

    if (result.passed) {
      success(result.message);
    } else {
      fail(result.message);
      if (result.details) {
        result.details.forEach((detail) => {
          log(`  → ${detail}`, colors.red);
        });
      }
      allPassed = false;
    }
    console.log();
  }

  // Summary
  log("═".repeat(70), colors.cyan);
  const passedCount = results.filter((r) => r.result.passed).length;
  const totalCount = results.length;

  if (allPassed) {
    log(`  ✅ ALL CHECKS PASSED (${passedCount}/${totalCount})`, colors.green);
    log("  Integration contract is being followed correctly", colors.green);
  } else {
    log(`  ❌ SOME CHECKS FAILED (${passedCount}/${totalCount} passed)`, colors.red);
    log("  Please fix violations before committing", colors.red);
  }

  log("═".repeat(70) + "\n", colors.cyan);

  // Exit code
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  fail(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  console.error(err);
  process.exit(1);
});

