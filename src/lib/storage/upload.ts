/**
 * Supabase Storage Operations
 */

import { getServiceSupabase } from "../supabase/server";

/**
 * Upload generation result to Supabase Storage
 * 
 * @param userId - User ID
 * @param generationId - Generation ID
 * @param imageUrl - Temporary image URL from Kie.ai
 * @param type - Generation type (photo, video, etc.)
 * @returns Public URL of uploaded file
 */
export async function uploadGenerationToStorage(
  userId: string,
  generationId: string,
  imageUrl: string,
  type: string = "photo"
): Promise<string> {
  const supabase = getServiceSupabase();

  try {
    // 1. Download image from Kie.ai
    console.log(`[Storage] Downloading image from: ${imageUrl}`);
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    console.log(`[Storage] Downloaded ${imageBuffer.length} bytes`);

    // 2. Upload to Supabase Storage
    const filePath = `${userId}/${type}/${generationId}.png`;
    console.log(`[Storage] Uploading to: ${filePath}`);

    const { data, error } = await supabase.storage
      .from("generations")
      .upload(filePath, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.error("[Storage] Upload error:", error);
      throw new Error(`Failed to upload to storage: ${error.message}`);
    }

    console.log(`[Storage] Upload successful: ${data.path}`);

    // 3. Get public URL
    const { data: urlData } = supabase.storage
      .from("generations")
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error("Failed to get public URL");
    }

    console.log(`[Storage] Public URL: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error("[Storage] Error:", error);
    throw error;
  }
}

/**
 * Delete file from storage
 */
export async function deleteGenerationFromStorage(
  userId: string,
  generationId: string,
  type: string = "photo"
): Promise<void> {
  const supabase = getServiceSupabase();

  const filePath = `${userId}/${type}/${generationId}.png`;

  const { error } = await supabase.storage
    .from("generations")
    .remove([filePath]);

  if (error) {
    console.error("[Storage] Delete error:", error);
    throw new Error(`Failed to delete from storage: ${error.message}`);
  }
}

