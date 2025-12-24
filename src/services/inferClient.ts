/**
 * Inference Client
 * 
 * Client-side utilities for making requests to the inference API.
 * All API keys are kept server-side - never exposed to the client.
 */

import { ModelDef } from "@/config/modelRegistry";

/**
 * Get all available models
 */
export async function getModels(): Promise<ModelDef[]> {
  try {
    const response = await fetch("/api/models", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const models: ModelDef[] = await response.json();
    return models;
  } catch (error) {
    console.error("[inferClient] Error fetching models:", error);
    throw error;
  }
}

/**
 * Inference request payload
 */
export interface InferPayload {
  modelId: string;
  inputs: {
    prompt: string;
    images?: string[]; // Base64 data URLs
  };
  params?: Record<string, any>;
  outputsCount?: number; // Batch generation: number of variants (default 1)
}

/**
 * Inference response
 */
export interface InferResult {
  success: boolean;
  urls?: string[];
  meta?: Record<string, any>;
  error?: string;
}

/**
 * Run inference on a model
 * 
 * @param payload - The inference request
 * @returns Result with generated URLs or error
 */
export async function infer(payload: InferPayload): Promise<InferResult> {
  try {
    console.log("[inferClient] Starting inference request");
    console.log("[inferClient] Model:", payload.modelId);
    console.log("[inferClient] Prompt:", payload.inputs.prompt?.substring(0, 100));

    const response = await fetch("/api/infer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data: InferResult = await response.json();

    if (!response.ok) {
      console.error("[inferClient] API error:", data.error);
      return {
        success: false,
        error: data.error || `API error: ${response.statusText}`,
      };
    }

    console.log("[inferClient] Inference successful");
    console.log("[inferClient] URLs received:", data.urls?.length || 0);

    return data;
  } catch (error) {
    console.error("[inferClient] Exception:", error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

