import { NextResponse } from "next/server";
import { getEnabledModels } from "@/config/modelRegistry";

/**
 * GET /api/models
 * 
 * Returns a list of all enabled AI models available for inference.
 * This endpoint is public and requires no authentication.
 */
export async function GET() {
  try {
    const models = getEnabledModels();
    
    return NextResponse.json(models, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error("[API:models] Error fetching models:", error);
    
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}

