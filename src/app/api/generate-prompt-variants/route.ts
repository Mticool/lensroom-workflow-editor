import { NextRequest, NextResponse } from "next/server";
import { generatePromptVariants } from "@/lib/llm/generatePromptVariants";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 1 minute

interface VariantsRequest {
  basePrompt: string;
  count: number;
}

interface VariantsResponse {
  success: boolean;
  variants?: string[];
  error?: string;
}

/**
 * POST /api/generate-prompt-variants
 * 
 * Generate N unique prompt variants using Anthropic
 * Used by Split Grid modal
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`\n[API:variants:${requestId}] ========== NEW REQUEST ==========`);

  try {
    const body: VariantsRequest = await request.json();
    const { basePrompt, count } = body;

    console.log(`[API:variants:${requestId}] Base: "${basePrompt?.substring(0, 50)}...", Count: ${count}`);

    // Validate
    if (!basePrompt || typeof basePrompt !== "string" || basePrompt.trim().length === 0) {
      return NextResponse.json<VariantsResponse>(
        { success: false, error: "basePrompt is required" },
        { status: 400 }
      );
    }

    if (!count || typeof count !== "number" || count <= 0 || count > 100) {
      return NextResponse.json<VariantsResponse>(
        { success: false, error: "count must be between 1 and 100" },
        { status: 400 }
      );
    }

    // Generate variants
    const variants = await generatePromptVariants(basePrompt.trim(), count);

    console.log(`[API:variants:${requestId}] ✅ Generated ${variants.length} variants`);

    return NextResponse.json<VariantsResponse>({
      success: true,
      variants,
    });
  } catch (error) {
    console.error(`[API:variants:${requestId}] ❌ Error:`, error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json<VariantsResponse>(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

