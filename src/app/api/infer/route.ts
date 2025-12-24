import { NextRequest, NextResponse } from "next/server";
import { getModelById } from "@/config/modelRegistry";
import { inferMarket, inferVeo, mockInfer, KieApiError } from "@/lib/kie/client";
import { getUserId } from "@/lib/auth/getUserId";
import { adjustCredits, getUserBalance } from "@/lib/supabase/server";
import {
  createGeneration,
  updateGenerationSuccess,
  updateGenerationFailed,
} from "@/lib/generations/db";
import { uploadGenerationToStorage } from "@/lib/storage/upload";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 300; // 5 minutes
export const dynamic = "force-dynamic";

interface InferRequest {
  modelId: string;
  inputs: {
    prompt: string;
    imageUrl?: string; // For edit models
  };
  params?: Record<string, any>;
  outputsCount?: number; // Batch generation: number of variants (default 1)
}

interface InferResponse {
  success: boolean;
  urls?: string[];
  text?: string; // For text models (Anthropic)
  meta?: Record<string, any>;
  newBalance?: number;
  error?: string;
}

/**
 * POST /api/infer
 * 
 * Universal inference endpoint for all AI models
 * 
 * Supports:
 * - anthropic_text (Anthropic)
 * - seedream_image (Kie Market)
 * - nano_banana_edit (Kie Market)
 * - veo3_video (Kie Veo)
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`\n[API:infer:${requestId}] ========== NEW REQUEST ==========`);
  console.log(`[API:infer:${requestId}] Timestamp: ${new Date().toISOString()}`);

  let generationId: string | undefined;
  let userId: string | null = null;

  try {
    // 1. AUTH: Get user ID
    userId = await getUserId(request);

    // DEV MODE: Fallback to TEST_USER_ID if no session
    if (!userId) {
      const allowAnon = process.env.ALLOW_ANON_INFER === "true";
      const testUserId = process.env.TEST_USER_ID;

      if (allowAnon && testUserId) {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(testUserId)) {
          console.error(`[API:infer:${requestId}] ❌ TEST_USER_ID is not a valid UUID: ${testUserId}`);
          return NextResponse.json<InferResponse>(
            { success: false, error: "Invalid TEST_USER_ID configuration" },
            { status: 500 }
          );
        }

        userId = testUserId;
        console.warn(`[API:infer:${requestId}] ⚠️ DEV MODE: Using TEST_USER_ID: ${userId}`);
        console.warn(`[API:infer:${requestId}] ⚠️ This is for development only! Disable ALLOW_ANON_INFER in production.`);
      } else {
        console.error(`[API:infer:${requestId}] ❌ Unauthorized - No session found`);
        return NextResponse.json<InferResponse>(
          { 
            success: false, 
            error: "Требуется вход. Выполните авторизацию или включите тестовый режим (ALLOW_ANON_INFER=true)." 
          },
          { status: 401 }
        );
      }
    }

    console.log(`[API:infer:${requestId}] User ID: ${userId}`);

    // 2. PARSE REQUEST
    const body: InferRequest = await request.json();
    const { modelId, inputs, params = {}, outputsCount = 1 } = body;

    console.log(`[API:infer:${requestId}] Model: ${modelId}`);
    console.log(`[API:infer:${requestId}] Prompt: ${inputs?.prompt?.substring(0, 100)}`);
    console.log(`[API:infer:${requestId}] Params:`, params);
    console.log(`[API:infer:${requestId}] Outputs Count: ${outputsCount}`);

    if (!modelId || !inputs?.prompt) {
      console.error(`[API:infer:${requestId}] ❌ Missing required fields`);
      return NextResponse.json<InferResponse>(
        { success: false, error: "modelId and inputs.prompt are required" },
        { status: 400 }
      );
    }

    // 3. VALIDATE MODEL
    const model = getModelById(modelId);

    if (!model || !model.enabled) {
      console.error(`[API:infer:${requestId}] ❌ Model not found or disabled: ${modelId}`);
      return NextResponse.json<InferResponse>(
        { success: false, error: `Model not found or disabled: ${modelId}` },
        { status: 404 }
      );
    }

    console.log(`[API:infer:${requestId}] Model found: ${model.title} (${model.provider})`);

    // 4. MOCK MODE CHECK
    const useMock = process.env.USE_MOCK_INFERENCE === "true";

    if (useMock) {
      console.log(`[API:infer:${requestId}] 🎭 MOCK MODE - Returning fake data`);
      const mockResult = await mockInfer(modelId, inputs.prompt);

      return NextResponse.json<InferResponse>({
        success: true,
        urls: mockResult.urls,
        meta: {
          modelId,
          taskId: mockResult.taskId,
          duration: mockResult.duration,
          mock: true,
        },
      });
    }

    // 5. CHECK CREDITS
    const cost = model.creditCost;
    const currentBalance = await getUserBalance(userId);

    console.log(`[API:infer:${requestId}] Cost: ${cost}, Balance: ${currentBalance}`);

    if (currentBalance < cost) {
      console.error(`[API:infer:${requestId}] ❌ Insufficient credits`);
      return NextResponse.json<InferResponse>(
        {
          success: false,
          error: `Insufficient credits. You have ${currentBalance}, need ${cost}.`,
        },
        { status: 402 }
      );
    }

    // 6. CREATE GENERATION RECORD
    generationId = crypto.randomUUID();
    const generationType = model.capability === "video" ? "video" : "photo";

    await createGeneration(
      userId,
      generationId,
      generationType,
      modelId,
      inputs.prompt,
      cost,
      {
        params,
        requestId,
        imageUrl: inputs.imageUrl,
      }
    );

    console.log(`[API:infer:${requestId}] ✓ Generation created: ${generationId}`);

    // 7. DEDUCT CREDITS
    const newBalance = await adjustCredits(
      userId,
      -cost,
      "generation",
      `${model.title}: ${inputs.prompt.substring(0, 100)}`,
      generationId
    );

    console.log(`[API:infer:${requestId}] ✓ Credits deducted. New balance: ${newBalance}`);

    // 8. HANDLE ANTHROPIC TEXT MODELS
    if (model.provider === "anthropic") {
      console.log(`[API:infer:${requestId}] 🤖 Calling Anthropic API...`);

      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

      if (!anthropicApiKey) {
        console.error(`[API:infer:${requestId}] ❌ ANTHROPIC_API_KEY missing`);
        return NextResponse.json<InferResponse>(
          { success: false, error: "ANTHROPIC_API_KEY not configured" },
          { status: 500 }
        );
      }

      try {
        const startTime = Date.now();
        const client = new Anthropic({ apiKey: anthropicApiKey });
        
        const anthropicModel = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
        const temperature = params.temperature ?? 0.7;
        const maxTokens = params.max_tokens ?? 800;

        console.log(`[API:infer:${requestId}] Model: ${anthropicModel}, temp: ${temperature}, max_tokens: ${maxTokens}`);

        const response = await client.messages.create({
          model: anthropicModel,
          max_tokens: maxTokens,
          temperature: temperature,
          messages: [{ role: "user", content: inputs.prompt }],
        });

        const duration = Date.now() - startTime;

        // Extract text from response
        const textContent = response.content
          .filter((block) => block.type === "text")
          .map((block) => (block as any).text)
          .join("\n");

        if (!textContent) {
          console.error(`[API:infer:${requestId}] ❌ No text in Anthropic response`);
          return NextResponse.json<InferResponse>(
            { success: false, error: "No text in response" },
            { status: 500 }
          );
        }

        console.log(`[API:infer:${requestId}] ✓ Anthropic complete (${duration}ms): ${textContent.length} chars`);

        // Return text response (no storage upload needed)
        return NextResponse.json<InferResponse>({
          success: true,
          text: textContent,
          meta: {
            modelId,
            provider: "anthropic",
            model: anthropicModel,
            duration,
            usage: {
              input_tokens: response.usage.input_tokens,
              output_tokens: response.usage.output_tokens,
            },
          },
          newBalance,
        });
      } catch (error) {
        console.error(`[API:infer:${requestId}] ❌ Anthropic error:`, error);
        const errorMessage = error instanceof Error ? error.message : "Anthropic API error";
        return NextResponse.json<InferResponse>(
          { success: false, error: errorMessage },
          { status: 500 }
        );
      }
    }

    // 9. CALL KIE.AI API
    const kieApiKey = process.env.KIE_API_KEY;

    if (!kieApiKey) {
      console.error(`[API:infer:${requestId}] ❌ KIE_API_KEY missing`);
      await updateGenerationFailed(generationId, "KIE_API_KEY not configured");
      return NextResponse.json<InferResponse>(
        { success: false, error: "KIE_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Helper: Single inference call
    const runSingleInference = async (): Promise<{ urls: string[]; taskId: string; duration: number }> => {
      if (model.kieProvider === "veo") {
        // Veo 3.1 video generation
        const aspectRatio = params.aspectRatio || "16:9";
        return await inferVeo(kieApiKey, inputs.prompt, aspectRatio);
      } else if (model.kieProvider === "market") {
        // Market API (Seedream, NanoBanana)
        // Build input based on model
        let kieInput: Record<string, any> = {
          prompt: inputs.prompt,
        };

        if (modelId === "seedream_image") {
          kieInput.image_size = params.image_size || "square_hd";
          kieInput.guidance_scale = 2.5;
          kieInput.enable_safety_checker = true;
        } else if (modelId === "nano_banana_edit") {
          // Nano Banana Edit requires imageUrl
          if (!inputs.imageUrl) {
            throw new Error("imageUrl is required for nano_banana_edit");
          }
          kieInput.image_urls = [inputs.imageUrl];
          kieInput.image_size = params.image_size || "1:1";
          kieInput.output_format = params.output_format || "png";
        }

        return await inferMarket(kieApiKey, model.kieModel!, kieInput);
      } else {
        throw new Error(`Unknown provider: ${model.kieProvider}`);
      }
    };

    // BATCH GENERATION
    let allKieUrls: string[] = [];
    let allTaskIds: string[] = [];
    let totalDuration = 0;
    let succeededCount = 0;
    let failedCount = 0;

    if (outputsCount === 1) {
      // Single generation (existing logic)
      console.log(`[API:infer:${requestId}] 🎨 Single generation`);
      const result = await runSingleInference();
      allKieUrls = result.urls;
      allTaskIds = [result.taskId];
      totalDuration = result.duration;
      succeededCount = 1;
    } else {
      // Batch generation (multiple variants)
      console.log(`[API:infer:${requestId}] 🎨🎨🎨 Batch generation: ${outputsCount} variants`);
      
      // Parallel execution with concurrency limit
      const CONCURRENCY_LIMIT = 3;
      const batchStartTime = Date.now();
      
      for (let i = 0; i < outputsCount; i += CONCURRENCY_LIMIT) {
        const batch = [];
        const batchSize = Math.min(CONCURRENCY_LIMIT, outputsCount - i);
        
        for (let j = 0; j < batchSize; j++) {
          const variantIndex = i + j;
          console.log(`[API:infer:${requestId}] Starting variant ${variantIndex + 1}/${outputsCount}...`);
          batch.push(
            runSingleInference()
              .then(result => ({ success: true, result }))
              .catch(error => ({ success: false, error }))
          );
        }
        
        // Wait for batch to complete (with error handling)
        const results = await Promise.all(batch);
        
        results.forEach((outcome, idx) => {
          if (outcome.success && 'result' in outcome) {
            allKieUrls.push(...outcome.result.urls);
            allTaskIds.push(outcome.result.taskId);
            succeededCount++;
            console.log(`[API:infer:${requestId}] ✓ Variant ${i + idx + 1} complete: ${outcome.result.taskId}`);
          } else {
            failedCount++;
            const errorMsg = 'error' in outcome ? outcome.error : 'Unknown error';
            console.error(`[API:infer:${requestId}] ❌ Variant ${i + idx + 1} failed:`, errorMsg);
          }
        });
      }
      
      totalDuration = Date.now() - batchStartTime;
      console.log(`[API:infer:${requestId}] ✓ Batch complete: ${succeededCount} succeeded, ${failedCount} failed in ${totalDuration}ms`);
      
      // If all failed, throw error
      if (succeededCount === 0) {
        throw new Error(`All ${outputsCount} generations failed`);
      }
    }

    console.log(`[API:infer:${requestId}] ✓ Inference complete: ${allKieUrls.length} URL(s)`);

    // 10. UPLOAD ALL TO STORAGE
    const publicUrls: string[] = [];

    try {
      console.log(`[API:infer:${requestId}] ⬆️  Uploading ${allKieUrls.length} file(s) to Supabase Storage...`);
      
      for (let i = 0; i < allKieUrls.length; i++) {
        const kieUrl = allKieUrls[i];
        const variantGenerationId = i === 0 ? generationId : `${generationId}_v${i}`;
        
        const publicUrl = await uploadGenerationToStorage(
          userId!,
          variantGenerationId,
          kieUrl,
          generationType
        );
        
        publicUrls.push(publicUrl);
        console.log(`[API:infer:${requestId}] ✓ Uploaded ${i + 1}/${allKieUrls.length}: ${publicUrl}`);
      }
    } catch (uploadError) {
      console.error(`[API:infer:${requestId}] ❌ Storage upload failed:`, uploadError);
      await updateGenerationFailed(
        generationId,
        `Storage upload failed: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`
      );
      return NextResponse.json<InferResponse>(
        { success: false, error: "Storage upload failed" },
        { status: 500 }
      );
    }

    // 11. UPDATE GENERATION STATUS
    await updateGenerationSuccess(generationId, publicUrls, {
      taskIds: allTaskIds,
      duration: totalDuration,
      outputsCount,
      originalUrls: allKieUrls,
    });

    console.log(`[API:infer:${requestId}] ✅ Complete! Generation: ${generationId}`);

    // 12. RETURN RESPONSE
    return NextResponse.json<InferResponse>({
      success: true,
      urls: publicUrls,
      meta: {
        modelId,
        generationId,
        taskIds: allTaskIds,
        duration: totalDuration,
        outputsCount,
        succeededCount,
        failedCount,
      },
      newBalance,
    });
  } catch (error) {
    console.error(`[API:infer:${requestId}] ❌❌❌ EXCEPTION ❌❌❌`);
    console.error(`[API:infer:${requestId}]`, error);

    // Update generation as failed
    if (generationId) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await updateGenerationFailed(generationId, errorMsg).catch((e) => {
        console.error(`[API:infer:${requestId}] Failed to update generation:`, e);
      });
    }

    // Handle Kie.ai API errors
    if (error instanceof KieApiError) {
      console.error(`[API:infer:${requestId}] Kie.ai Error: ${error.message}`);
      console.error(`[API:infer:${requestId}] Status: ${error.statusCode}`);

      let errorMessage = error.message;

      if (error.statusCode === 402) {
        errorMessage = "Insufficient credits on Kie.ai account";
      } else if (error.statusCode === 504) {
        errorMessage = "Task timed out. Please try again.";
      }

      return NextResponse.json<InferResponse>(
        { success: false, error: errorMessage },
        { status: error.statusCode }
      );
    }

    // Generic error
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json<InferResponse>(
      { success: false, error: `Inference failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
