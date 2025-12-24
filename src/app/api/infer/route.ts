import { NextRequest, NextResponse } from "next/server";
import { getModelById } from "@/config/modelRegistry";
import { inferMarket, inferVeo, mockInfer, KieApiError } from "@/lib/kie/client";
import { getUserId } from "@/lib/auth/getUserId";
import Anthropic from "@anthropic-ai/sdk";
import {
  SupabaseUnavailableError,
  tryGetBalance,
  tryAdjustCredits,
  tryCreateGeneration,
  tryUpdateGenerationSuccess,
  tryUpdateGenerationFailed,
  tryUploadToStorage,
} from "@/lib/supabase/fallback";

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
 * Supports fallback mode (INFER_SUPABASE_OPTIONAL=true):
 * - Works without Supabase env vars or network
 * - Returns Kie.ai URLs directly
 * - Skips credits/generations/storage
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

  const supabaseOptional = process.env.INFER_SUPABASE_OPTIONAL === "true";
  let generationId: string | undefined;
  let userId: string | null = null;
  let supabaseSkipped = false;
  let supabaseSkipReason: string | null = null;

  try {
    // 1. AUTH: Get user ID (may be null in fallback mode)
    try {
      userId = await getUserId(request);
    } catch (authError) {
      // If getUserId fails due to missing Supabase env vars and we're in fallback mode, continue
      if (supabaseOptional && authError instanceof Error && authError.message.includes("NEXT_PUBLIC_SUPABASE_URL")) {
        console.warn(`[API:infer:${requestId}] ⚠️ Auth failed (Supabase not configured), but INFER_SUPABASE_OPTIONAL=true - continuing without userId`);
        userId = null;
      } else {
        // Re-throw if not a Supabase config error or not in fallback mode
        throw authError;
      }
    }

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
      } else if (!supabaseOptional) {
        // Only require auth if Supabase is not optional
        console.error(`[API:infer:${requestId}] ❌ Unauthorized - No session found`);
        return NextResponse.json<InferResponse>(
          { 
            success: false, 
            error: "Требуется вход. Выполните авторизацию или включите тестовый режим (ALLOW_ANON_INFER=true)." 
          },
          { status: 401 }
        );
      } else {
        // Supabase optional mode: allow null userId
        console.warn(`[API:infer:${requestId}] ⚠️ No userId, but INFER_SUPABASE_OPTIONAL=true - continuing without auth`);
      }
    }

    console.log(`[API:infer:${requestId}] User ID: ${userId || "null (fallback mode)"}`);

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

    // 5. TRY CHECK CREDITS (with fallback)
    const cost = model.creditCost;
    let currentBalance: number | null = null;

    try {
      currentBalance = await tryGetBalance(userId);
      console.log(`[API:infer:${requestId}] Cost: ${cost}, Balance: ${currentBalance ?? "N/A"}`);

      if (currentBalance !== null && currentBalance < cost) {
        console.error(`[API:infer:${requestId}] ❌ Insufficient credits`);
        return NextResponse.json<InferResponse>(
          {
            success: false,
            error: `Insufficient credits. You have ${currentBalance}, need ${cost}.`,
          },
          { status: 402 }
        );
      }
    } catch (error) {
      if (error instanceof SupabaseUnavailableError) {
        if (supabaseOptional) {
          console.warn(`[API:infer:${requestId}] ⚠️ Supabase unavailable (${error.reason}), skipping credit check`);
          supabaseSkipped = true;
          supabaseSkipReason = error.reason;
        } else {
          console.error(`[API:infer:${requestId}] ❌ Supabase required but unavailable: ${error.message}`);
          return NextResponse.json<InferResponse>(
            { success: false, error: `Supabase недоступен: ${error.message}` },
            { status: 503 }
          );
        }
      } else {
        throw error;
      }
    }

    // 6. TRY CREATE GENERATION RECORD (with fallback)
    generationId = crypto.randomUUID();
    const generationType = model.capability === "video" ? "video" : "photo";

    try {
      await tryCreateGeneration(
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
    } catch (error) {
      if (error instanceof SupabaseUnavailableError) {
        if (supabaseOptional) {
          console.warn(`[API:infer:${requestId}] ⚠️ Supabase unavailable, skipping generation record`);
          supabaseSkipped = true;
          supabaseSkipReason = error.reason;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // 7. TRY DEDUCT CREDITS (with fallback)
    let newBalance: number | null = null;

    try {
      if (currentBalance !== null) {
        newBalance = await tryAdjustCredits(
          userId,
          -cost,
          "generation",
          `${model.title}: ${inputs.prompt.substring(0, 100)}`,
          generationId
        );
        console.log(`[API:infer:${requestId}] ✓ Credits deducted. New balance: ${newBalance}`);
      }
    } catch (error) {
      if (error instanceof SupabaseUnavailableError) {
        if (supabaseOptional) {
          console.warn(`[API:infer:${requestId}] ⚠️ Supabase unavailable, skipping credit deduction`);
          supabaseSkipped = true;
          supabaseSkipReason = error.reason;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // 8. HANDLE ANTHROPIC TEXT MODELS
    if (model.provider === "anthropic") {
      console.log(`[API:infer:${requestId}] 🤖 Calling Anthropic API...`);

      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

      if (!anthropicApiKey) {
        console.error(`[API:infer:${requestId}] ❌ ANTHROPIC_API_KEY missing`);
        await tryUpdateGenerationFailed(generationId, "ANTHROPIC_API_KEY not configured");
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
          await tryUpdateGenerationFailed(generationId, "No text in response");
          return NextResponse.json<InferResponse>(
            { success: false, error: "No text in response" },
            { status: 500 }
          );
        }

        console.log(`[API:infer:${requestId}] ✓ Anthropic complete (${duration}ms): ${textContent.length} chars`);

        // Try update generation success
        try {
          await tryUpdateGenerationSuccess(generationId, [], {
            provider: "anthropic",
            model: anthropicModel,
            duration,
            usage: {
              input_tokens: response.usage.input_tokens,
              output_tokens: response.usage.output_tokens,
            },
          });
        } catch (error) {
          if (error instanceof SupabaseUnavailableError && supabaseOptional) {
            console.warn(`[API:infer:${requestId}] ⚠️ Supabase unavailable, skipping generation update`);
          } else if (!supabaseOptional) {
            throw error;
          }
        }

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
            ...(supabaseSkipped && {
              supabase: "skipped",
              reason: supabaseSkipReason,
            }),
          },
          ...(newBalance !== null && { newBalance }),
        });
      } catch (error) {
        console.error(`[API:infer:${requestId}] ❌ Anthropic error:`, error);
        await tryUpdateGenerationFailed(
          generationId,
          error instanceof Error ? error.message : "Anthropic API error"
        );
        return NextResponse.json<InferResponse>(
          { success: false, error: error instanceof Error ? error.message : "Anthropic API error" },
          { status: 500 }
        );
      }
    }

    // 9. CALL KIE.AI API (ALWAYS - this is the core functionality)
    const kieApiKey = process.env.KIE_API_KEY;

    if (!kieApiKey) {
      console.error(`[API:infer:${requestId}] ❌ KIE_API_KEY missing`);
      await tryUpdateGenerationFailed(generationId, "Не настроен провайдер. Проверьте KIE_API_KEY в окружении.");
      return NextResponse.json<InferResponse>(
        { success: false, error: "Не настроен провайдер. Проверьте KIE_API_KEY в окружении." },
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
        } else if (modelId === "nano_banana_edit" || modelId === "nano_banana_pro_edit") {
          // Nano Banana Edit/Pro requires imageUrl
          if (!inputs.imageUrl) {
            console.error(`[API:infer:${requestId}] ❌ Missing imageUrl for edit model`);
            await tryUpdateGenerationFailed(generationId, "Подключите входное изображение");
            return NextResponse.json<InferResponse>(
              { success: false, error: "Подключите входное изображение" },
              { status: 400 }
            );
          }
          kieInput.image_urls = [inputs.imageUrl];
          kieInput.aspectRatio = params.aspectRatio || "1:1";
          
          // Pro-only features
          if (modelId === "nano_banana_pro_edit") {
            if (params.resolution) {
              kieInput.resolution = params.resolution;
            }
            if (params.useGoogleSearch) {
              kieInput.tools = [{ googleSearch: {} }];
            }
          }
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
      // Single generation
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

    // 10. TRY UPLOAD TO STORAGE (with fallback)
    let publicUrls: string[] = allKieUrls; // Default: use Kie.ai URLs directly

    try {
      console.log(`[API:infer:${requestId}] ⬆️  Uploading ${allKieUrls.length} file(s) to Supabase Storage...`);
      
      publicUrls = [];
      for (let i = 0; i < allKieUrls.length; i++) {
        const kieUrl = allKieUrls[i];
        const variantGenerationId = i === 0 ? generationId : `${generationId}_v${i}`;
        
        const publicUrl = await tryUploadToStorage(
          userId,
          variantGenerationId,
          kieUrl,
          generationType
        );
        
        if (publicUrl) {
          publicUrls.push(publicUrl);
          console.log(`[API:infer:${requestId}] ✓ Uploaded ${i + 1}/${allKieUrls.length}: ${publicUrl}`);
        } else {
          // Fallback to Kie.ai URL if upload returns null
          publicUrls.push(kieUrl);
          console.log(`[API:infer:${requestId}] ⚠️ Upload returned null, using Kie.ai URL: ${kieUrl}`);
        }
      }
    } catch (error) {
      if (error instanceof SupabaseUnavailableError) {
        if (supabaseOptional) {
          console.warn(`[API:infer:${requestId}] ⚠️ Supabase unavailable, using Kie.ai URLs directly`);
          supabaseSkipped = true;
          supabaseSkipReason = error.reason;
          publicUrls = allKieUrls; // Use Kie.ai URLs directly
        } else {
          console.error(`[API:infer:${requestId}] ❌ Storage upload failed:`, error);
          await tryUpdateGenerationFailed(
            generationId,
            `Storage upload failed: ${error.message}`
          );
          return NextResponse.json<InferResponse>(
            { success: false, error: "Storage upload failed" },
            { status: 500 }
          );
        }
      } else {
        throw error;
      }
    }

    // 11. TRY UPDATE GENERATION STATUS (with fallback)
    try {
      await tryUpdateGenerationSuccess(generationId, publicUrls, {
        taskIds: allTaskIds,
        duration: totalDuration,
        outputsCount,
        originalUrls: allKieUrls,
      });
      console.log(`[API:infer:${requestId}] ✅ Complete! Generation: ${generationId}`);
    } catch (error) {
      if (error instanceof SupabaseUnavailableError) {
        if (supabaseOptional) {
          console.warn(`[API:infer:${requestId}] ⚠️ Supabase unavailable, skipping generation update`);
          supabaseSkipped = true;
          supabaseSkipReason = error.reason;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // 12. RETURN RESPONSE
    const responseMeta: Record<string, any> = {
      modelId,
      provider: "kie",
      taskIds: allTaskIds,
      duration: totalDuration,
      outputsCount,
      succeededCount,
      failedCount,
    };

    if (generationId) {
      responseMeta.generationId = generationId;
    }

    if (supabaseSkipped) {
      responseMeta.supabase = "skipped";
      responseMeta.reason = supabaseSkipReason || "unknown";
    }

    return NextResponse.json<InferResponse>({
      success: true,
      urls: publicUrls,
      meta: responseMeta,
      ...(newBalance !== null && { newBalance }),
    });
  } catch (error) {
    console.error(`[API:infer:${requestId}] ❌❌❌ EXCEPTION ❌❌❌`);
    console.error(`[API:infer:${requestId}]`, error);

    // Try update generation as failed
    try {
      await tryUpdateGenerationFailed(
        generationId,
        error instanceof Error ? error.message : String(error)
      );
    } catch (updateError) {
      // Ignore update errors in fallback mode
      if (!(updateError instanceof SupabaseUnavailableError && supabaseOptional)) {
        console.error(`[API:infer:${requestId}] Failed to update generation:`, updateError);
      }
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
