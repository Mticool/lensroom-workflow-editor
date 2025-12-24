import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/getUserId";
import { getServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 1 minute

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadResponse {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

/**
 * POST /api/upload
 * 
 * Upload image to Supabase Storage
 * Used for NanoBanana Edit image input
 * 
 * Request: multipart/form-data with 'file' field
 * Response: { success: true, url: publicUrl, path: storagePath }
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`\n[API:upload:${requestId}] ========== NEW UPLOAD ==========`);

  try {
    // 1. AUTH: Get user ID
    const userId = await getUserId(request);

    if (!userId) {
      console.error(`[API:upload:${requestId}] ❌ Unauthorized`);
      return NextResponse.json<UploadResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log(`[API:upload:${requestId}] User ID: ${userId}`);

    // 2. PARSE FORM DATA
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      console.error(`[API:upload:${requestId}] ❌ No file provided`);
      return NextResponse.json<UploadResponse>(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    console.log(`[API:upload:${requestId}] File: ${file.name} (${file.type}, ${file.size} bytes)`);

    // 3. VALIDATE FILE TYPE
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.error(`[API:upload:${requestId}] ❌ Invalid file type: ${file.type}`);
      return NextResponse.json<UploadResponse>(
        {
          success: false,
          error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 4. VALIDATE FILE SIZE
    if (file.size > MAX_FILE_SIZE) {
      console.error(`[API:upload:${requestId}] ❌ File too large: ${file.size} bytes`);
      return NextResponse.json<UploadResponse>(
        {
          success: false,
          error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }

    // 5. PREPARE FILE BUFFER
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[API:upload:${requestId}] File buffer size: ${buffer.length} bytes`);

    // 6. GENERATE STORAGE PATH
    const fileId = crypto.randomUUID();
    const extension = file.name.split(".").pop() || "png";
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .substring(0, 100);
    const fileName = `${fileId}_${sanitizedName}`;
    const storagePath = `${userId}/uploads/${fileName}`;

    console.log(`[API:upload:${requestId}] Storage path: ${storagePath}`);

    // 7. UPLOAD TO SUPABASE STORAGE
    const supabase = getServiceSupabase();

    const { data, error } = await supabase.storage
      .from("generations")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false, // Don't overwrite
      });

    if (error) {
      console.error(`[API:upload:${requestId}] ❌ Upload error:`, error);
      return NextResponse.json<UploadResponse>(
        {
          success: false,
          error: `Upload failed: ${error.message}`,
        },
        { status: 500 }
      );
    }

    console.log(`[API:upload:${requestId}] ✓ Uploaded: ${data.path}`);

    // 8. GET PUBLIC URL
    const { data: urlData } = supabase.storage
      .from("generations")
      .getPublicUrl(storagePath);

    if (!urlData?.publicUrl) {
      console.error(`[API:upload:${requestId}] ❌ Failed to get public URL`);
      return NextResponse.json<UploadResponse>(
        { success: false, error: "Failed to get public URL" },
        { status: 500 }
      );
    }

    console.log(`[API:upload:${requestId}] ✓ Public URL: ${urlData.publicUrl}`);
    console.log(`[API:upload:${requestId}] ✅ Upload complete!`);

    // 9. RETURN SUCCESS
    return NextResponse.json<UploadResponse>({
      success: true,
      url: urlData.publicUrl,
      path: storagePath,
    });
  } catch (error) {
    console.error(`[API:upload:${requestId}] ❌❌❌ EXCEPTION ❌❌❌`);
    console.error(`[API:upload:${requestId}]`, error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json<UploadResponse>(
      {
        success: false,
        error: `Upload failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

