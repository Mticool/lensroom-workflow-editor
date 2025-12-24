import { NextRequest, NextResponse } from "next/server";
import { GenerateResponse } from "@/types";

/**
 * @deprecated This route is deprecated. Use /api/infer instead.
 * Nano Banana models now work through Kie.ai via /api/infer.
 * This route is kept for backwards compatibility but will return an error.
 */
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.warn(`[API:generate:${requestId}] ⚠️ DEPRECATED: /api/generate is deprecated. Use /api/infer instead.`);

  return NextResponse.json<GenerateResponse>(
    {
      success: false,
      error: "Этот эндпоинт устарел. Используйте /api/infer. Nano Banana теперь работает через Kie.ai. Проверьте KIE_API_KEY в окружении.",
    },
    { status: 410 } // 410 Gone - resource is permanently unavailable
  );
}
