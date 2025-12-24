/**
 * Get User ID from Request
 * 
 * Supports multiple auth methods:
 * 1. TEST_MODE - Returns TEST_USER_ID (for Vercel preview/testing)
 * 2. lr_session cookie (JWT)
 * 3. Supabase auth cookies
 */

import { NextRequest } from "next/server";
import { getServiceSupabase } from "../supabase/server";

/**
 * Extract user ID from request
 * 
 * @param request - Next.js request object
 * @returns User ID (UUID) or null if not authenticated
 */
export async function getUserId(request: NextRequest): Promise<string | null> {
  // TEST_MODE: Use TEST_USER_ID (for Vercel preview)
  if (process.env.TEST_MODE === "true") {
    const testUserId = process.env.TEST_USER_ID;
    
    if (!testUserId) {
      throw new Error("TEST_MODE is enabled but TEST_USER_ID is not set");
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(testUserId)) {
      throw new Error(`TEST_USER_ID is not a valid UUID: ${testUserId}`);
    }
    
    console.log(`[Auth] TEST_MODE: Using TEST_USER_ID: ${testUserId}`);
    return testUserId;
  }
  
  const supabase = getServiceSupabase();

  // Method 1: Try lr_session JWT cookie
  const lrSessionCookie = request.cookies.get("lr_session");
  if (lrSessionCookie?.value) {
    try {
      // Verify JWT using Supabase
      const { data, error } = await supabase.auth.getUser(lrSessionCookie.value);
      
      if (!error && data?.user?.id) {
        console.log(`[Auth] Authenticated via lr_session: ${data.user.id}`);
        return data.user.id;
      }
    } catch (error) {
      console.warn("[Auth] Failed to verify lr_session JWT:", error);
    }
  }

  // Method 2: Try Supabase auth cookies
  // Parse all cookies for Supabase session
  const authToken = 
    request.cookies.get("sb-access-token")?.value ||
    request.cookies.get("supabase-auth-token")?.value;

  if (authToken) {
    try {
      const { data, error } = await supabase.auth.getUser(authToken);
      
      if (!error && data?.user?.id) {
        console.log(`[Auth] Authenticated via Supabase token: ${data.user.id}`);
        return data.user.id;
      }
    } catch (error) {
      console.warn("[Auth] Failed to verify Supabase token:", error);
    }
  }

  // Method 3: Try Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const { data, error } = await supabase.auth.getUser(token);
      
      if (!error && data?.user?.id) {
        console.log(`[Auth] Authenticated via Bearer token: ${data.user.id}`);
        return data.user.id;
      }
    } catch (error) {
      console.warn("[Auth] Failed to verify Bearer token:", error);
    }
  }

  console.warn("[Auth] No valid authentication found");
  return null;
}

/**
 * Get user ID or throw 401 error
 * 
 * @param request - Next.js request object
 * @returns User ID (guaranteed non-null)
 * @throws {Error} If user is not authenticated
 */
export async function requireUserId(request: NextRequest): Promise<string> {
  const userId = await getUserId(request);
  
  if (!userId) {
    throw new Error("Unauthorized: No valid session found");
  }
  
  return userId;
}

