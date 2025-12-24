/**
 * Generations Database Operations
 */

import { getServiceSupabase } from "../supabase/server";

export interface Generation {
  id: string;
  user_id: string;
  type: string;
  model: string;
  prompt: string | null;
  status: "pending" | "processing" | "success" | "failed";
  result_urls: string[];
  credits_used: number;
  preview_path: string | null;
  poster_path: string | null;
  preview_status: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new generation record
 */
export async function createGeneration(
  userId: string,
  generationId: string,
  type: string,
  model: string,
  prompt: string,
  creditsUsed: number,
  metadata: Record<string, any> = {}
): Promise<Generation> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("generations")
    .insert({
      id: generationId,
      user_id: userId,
      type,
      model,
      prompt,
      status: "processing",
      credits_used: creditsUsed,
      metadata,
    })
    .select()
    .single();

  if (error) {
    console.error("[Generations] Create error:", error);
    throw new Error(`Failed to create generation: ${error.message}`);
  }

  return data as Generation;
}

/**
 * Update generation status to success
 */
export async function updateGenerationSuccess(
  generationId: string,
  resultUrls: string[],
  metadata: Record<string, any> = {}
): Promise<void> {
  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from("generations")
    .update({
      status: "success",
      result_urls: resultUrls,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", generationId);

  if (error) {
    console.error("[Generations] Update success error:", error);
    throw new Error(`Failed to update generation: ${error.message}`);
  }
}

/**
 * Update generation status to failed
 */
export async function updateGenerationFailed(
  generationId: string,
  errorMessage: string
): Promise<void> {
  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from("generations")
    .update({
      status: "failed",
      metadata: { error: errorMessage },
      updated_at: new Date().toISOString(),
    })
    .eq("id", generationId);

  if (error) {
    console.error("[Generations] Update failed error:", error);
    throw new Error(`Failed to update generation: ${error.message}`);
  }
}

/**
 * Get generation by ID
 */
export async function getGeneration(generationId: string): Promise<Generation | null> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("id", generationId)
    .single();

  if (error) {
    console.error("[Generations] Get error:", error);
    return null;
  }

  return data as Generation;
}

/**
 * Get user's generations
 */
export async function getUserGenerations(
  userId: string,
  limit: number = 20
): Promise<Generation[]> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Generations] Get user generations error:", error);
    throw new Error(`Failed to get generations: ${error.message}`);
  }

  return data as Generation[];
}

