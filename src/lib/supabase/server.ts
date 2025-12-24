/**
 * Supabase Server Client
 * 
 * DO NOT expose service role key to client
 * Use only in server-side code (API routes, server components)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;

/**
 * Get Supabase admin client with service role key
 * 
 * @throws {Error} If required environment variables are missing
 * @returns Supabase client with elevated permissions
 */
export function getServiceSupabase(): SupabaseClient {
  // Reuse existing instance
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseOptional = process.env.INFER_SUPABASE_OPTIONAL === "true";

  if (!supabaseUrl) {
    const errorMessage = "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. " +
      "Please add it to your .env.local file.";
    
    // In fallback mode, throw a more specific error that can be caught
    if (supabaseOptional) {
      const error = new Error(errorMessage);
      error.name = "SupabaseConfigError";
      throw error;
    }
    
    throw new Error(errorMessage);
  }

  if (!serviceRoleKey) {
    const errorMessage = "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
      "Please add it to your .env.local file. " +
      "WARNING: Never expose this key to the client!";
    
    // In fallback mode, throw a more specific error that can be caught
    if (supabaseOptional) {
      const error = new Error(errorMessage);
      error.name = "SupabaseConfigError";
      throw error;
    }
    
    throw new Error(errorMessage);
  }

  // Validate URL format
  try {
    new URL(supabaseUrl);
  } catch (error) {
    throw new Error(
      `Invalid NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}. ` +
      "Must be a valid URL (e.g., https://xxxxx.supabase.co)"
    );
  }

  // Create admin client
  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("[Supabase] Service client initialized");

  return supabaseAdmin;
}

/**
 * Get user's credit balance
 */
export async function getUserBalance(userId: string): Promise<number> {
  const supabase = getServiceSupabase();
  
  const { data, error } = await supabase.rpc("get_user_balance", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[Supabase] Error getting balance:", error);
    throw new Error(`Failed to get user balance: ${error.message}`);
  }

  return data as number;
}

/**
 * Adjust user credits atomically
 * 
 * @returns New balance or throws error
 */
export async function adjustCredits(
  userId: string,
  amount: number,
  type: string,
  description?: string,
  generationId?: string,
  metadata?: Record<string, any>
): Promise<number> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase.rpc("adjust_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_description: description || null,
    p_generation_id: generationId || null,
    p_metadata: metadata || {},
  });

  if (error) {
    console.error("[Supabase] RPC error:", error);
    throw new Error(`Failed to adjust credits: ${error.message}`);
  }

  const result = data as {
    success: boolean;
    new_balance: number | null;
    error: string | null;
  };

  if (!result.success) {
    throw new Error(result.error || "Failed to adjust credits");
  }

  return result.new_balance!;
}
