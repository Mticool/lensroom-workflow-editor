/**
 * Supabase Fallback Helpers
 * 
 * Wraps Supabase operations in try-catch with fallback support.
 * Used when INFER_SUPABASE_OPTIONAL=true to allow inference without Supabase.
 */

export class SupabaseUnavailableError extends Error {
  constructor(
    message: string,
    public reason: "missing_env" | "network_error" | "auth_error" | "other"
  ) {
    super(message);
    this.name = "SupabaseUnavailableError";
  }
}

/**
 * Check if Supabase env vars are configured
 */
function checkSupabaseEnv(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new SupabaseUnavailableError(
      "Supabase environment variables not configured",
      "missing_env"
    );
  }
}

/**
 * Wrap Supabase operation with error handling
 */
async function wrapSupabaseOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    checkSupabaseEnv();
    return await operation();
  } catch (error) {
    if (error instanceof SupabaseUnavailableError) {
      throw error;
    }

    // Check for network errors
    if (error instanceof Error) {
      if (
        error.message.includes("fetch") ||
        error.message.includes("network") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("timeout")
      ) {
        throw new SupabaseUnavailableError(
          `Network error during ${operationName}: ${error.message}`,
          "network_error"
        );
      }

      if (
        error.message.includes("auth") ||
        error.message.includes("unauthorized") ||
        error.message.includes("JWT")
      ) {
        throw new SupabaseUnavailableError(
          `Auth error during ${operationName}: ${error.message}`,
          "auth_error"
        );
      }
    }

    // Generic error
    throw new SupabaseUnavailableError(
      `Error during ${operationName}: ${error instanceof Error ? error.message : String(error)}`,
      "other"
    );
  }
}

/**
 * Try to get user balance (with fallback support)
 */
export async function tryGetBalance(
  userId: string | null
): Promise<number | null> {
  if (!userId) {
    return null;
  }

  try {
    const { getUserBalance } = await import("../supabase/server");
    return await wrapSupabaseOperation(
      () => getUserBalance(userId),
      "getUserBalance"
    );
  } catch (error) {
    // Catch SupabaseConfigError from getServiceSupabase() and convert to SupabaseUnavailableError
    if (error instanceof Error && error.name === "SupabaseConfigError") {
      throw new SupabaseUnavailableError(error.message, "missing_env");
    }
    throw error;
  }
}

/**
 * Try to adjust credits (with fallback support)
 */
export async function tryAdjustCredits(
  userId: string | null,
  amount: number,
  type: string,
  description?: string,
  generationId?: string,
  metadata?: Record<string, any>
): Promise<number | null> {
  if (!userId) {
    return null;
  }

  try {
    const { adjustCredits } = await import("../supabase/server");
    return await wrapSupabaseOperation(
      () =>
        adjustCredits(userId, amount, type, description, generationId, metadata),
      "adjustCredits"
    );
  } catch (error) {
    // Catch SupabaseConfigError from getServiceSupabase() and convert to SupabaseUnavailableError
    if (error instanceof Error && error.name === "SupabaseConfigError") {
      throw new SupabaseUnavailableError(error.message, "missing_env");
    }
    throw error;
  }
}

/**
 * Try to create generation record (with fallback support)
 */
export async function tryCreateGeneration(
  userId: string | null,
  generationId: string,
  type: string,
  model: string,
  prompt: string,
  creditsUsed: number,
  metadata: Record<string, any> = {}
): Promise<void> {
  if (!userId) {
    return;
  }

  try {
    const { createGeneration } = await import("../generations/db");
    await wrapSupabaseOperation(
      () =>
        createGeneration(
          userId,
          generationId,
          type,
          model,
          prompt,
          creditsUsed,
          metadata
        ),
      "createGeneration"
    );
  } catch (error) {
    // Catch SupabaseConfigError from getServiceSupabase() and convert to SupabaseUnavailableError
    if (error instanceof Error && error.name === "SupabaseConfigError") {
      throw new SupabaseUnavailableError(error.message, "missing_env");
    }
    throw error;
  }
}

/**
 * Try to update generation success (with fallback support)
 */
export async function tryUpdateGenerationSuccess(
  generationId: string | undefined,
  resultUrls: string[],
  metadata: Record<string, any> = {}
): Promise<void> {
  if (!generationId) {
    return;
  }

  try {
    const { updateGenerationSuccess } = await import("../generations/db");
    await wrapSupabaseOperation(
      () => updateGenerationSuccess(generationId, resultUrls, metadata),
      "updateGenerationSuccess"
    );
  } catch (error) {
    // Catch SupabaseConfigError from getServiceSupabase() and convert to SupabaseUnavailableError
    if (error instanceof Error && error.name === "SupabaseConfigError") {
      throw new SupabaseUnavailableError(error.message, "missing_env");
    }
    throw error;
  }
}

/**
 * Try to update generation failed (with fallback support)
 */
export async function tryUpdateGenerationFailed(
  generationId: string | undefined,
  errorMessage: string
): Promise<void> {
  if (!generationId) {
    return;
  }

  try {
    const { updateGenerationFailed } = await import("../generations/db");
    await wrapSupabaseOperation(
      () => updateGenerationFailed(generationId, errorMessage),
      "updateGenerationFailed"
    );
  } catch (error) {
    // Catch SupabaseConfigError from getServiceSupabase() and convert to SupabaseUnavailableError
    if (error instanceof Error && error.name === "SupabaseConfigError") {
      throw new SupabaseUnavailableError(error.message, "missing_env");
    }
    throw error;
  }
}

/**
 * Try to upload to storage (with fallback support)
 */
export async function tryUploadToStorage(
  userId: string | null,
  generationId: string | undefined,
  imageUrl: string,
  type: string = "photo"
): Promise<string | null> {
  if (!userId || !generationId) {
    return null;
  }

  try {
    const { uploadGenerationToStorage } = await import("../storage/upload");
    return await wrapSupabaseOperation(
      () => uploadGenerationToStorage(userId, generationId, imageUrl, type),
      "uploadToStorage"
    );
  } catch (error) {
    // Catch SupabaseConfigError from getServiceSupabase() and convert to SupabaseUnavailableError
    if (error instanceof Error && error.name === "SupabaseConfigError") {
      throw new SupabaseUnavailableError(error.message, "missing_env");
    }
    throw error;
  }
}

