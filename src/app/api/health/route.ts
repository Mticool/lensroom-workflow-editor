import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

/**
 * GET /api/health
 * 
 * Health check endpoint showing environment configuration and Supabase connectivity.
 * In fallback mode (INFER_SUPABASE_OPTIONAL=true), Supabase errors are not critical.
 */
export async function GET() {
  const supabaseOptional = process.env.INFER_SUPABASE_OPTIONAL === "true";
  
  const health: Record<string, any> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      KIE_API_KEY: !!process.env.KIE_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      INFER_SUPABASE_OPTIONAL: supabaseOptional,
      ALLOW_ANON_INFER: process.env.ALLOW_ANON_INFER === "true",
      USE_MOCK_INFERENCE: process.env.USE_MOCK_INFERENCE === "true",
    },
    supabase: {
      configured: false,
      reachable: false,
      error: null as string | null,
    },
  };

  // Check Supabase connectivity
  if (health.env.NEXT_PUBLIC_SUPABASE_URL && health.env.SUPABASE_SERVICE_ROLE_KEY) {
    health.supabase.configured = true;

    try {
      const supabase = getServiceSupabase();
      // Simple query to check connectivity
      const { error } = await supabase.from("generations").select("id").limit(1);
      
      if (error) {
        health.supabase.error = error.message;
        if (!supabaseOptional) {
          health.status = "degraded";
        }
      } else {
        health.supabase.reachable = true;
      }
    } catch (error) {
      health.supabase.error = error instanceof Error ? error.message : String(error);
      if (!supabaseOptional) {
        health.status = "degraded";
      }
    }
  } else {
    health.supabase.error = "Environment variables not configured";
    if (!supabaseOptional) {
      health.status = "degraded";
    }
  }

  // Check critical dependencies
  if (!health.env.KIE_API_KEY && !health.env.USE_MOCK_INFERENCE) {
    health.status = "degraded";
    health.error = "KIE_API_KEY not configured (required for real inference)";
  }

  const statusCode = health.status === "ok" ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}

