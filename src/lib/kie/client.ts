/**
 * Kie.ai API Client
 * 
 * Supports two API types:
 * 1. Market API - For Seedream, NanoBanana Edit, etc.
 * 2. Veo API - For Veo 3.1 video generation
 */

export class KieApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = "KieApiError";
  }
}

// ============================================
// Market API (Seedream, NanoBanana, etc.)
// ============================================

interface MarketCreateTaskRequest {
  model: string;
  callBackUrl?: string | null;
  input: Record<string, any>;
}

interface MarketCreateTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface MarketRecordInfoResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    state: "waiting" | "queuing" | "generating" | "success" | "fail";
    resultJson?: string;  // JSON string with resultUrls
    failMsg?: string;
  };
}

/**
 * Create task on Kie.ai Market API
 */
export async function createMarketTask(
  apiKey: string,
  model: string,
  input: Record<string, any>
): Promise<string> {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[Kie:Market:${requestId}] Creating task for model: ${model}`);

  const payload: MarketCreateTaskRequest = {
    model,
    callBackUrl: null,
    input,
  };

  console.log(`[Kie:Market:${requestId}] Request payload:`, JSON.stringify(payload, null, 2));

  const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[Kie:Market:${requestId}] HTTP error:`, response.status, text);
    throw new KieApiError(
      `Kie.ai API returned ${response.status}`,
      response.status,
      text
    );
  }

  const data: MarketCreateTaskResponse = await response.json();
  console.log(`[Kie:Market:${requestId}] Response:`, JSON.stringify(data, null, 2));

  if (data.code !== 200 || !data.data?.taskId) {
    console.error(`[Kie:Market:${requestId}] Invalid response:`, data);
    throw new KieApiError(
      data.msg || "Failed to create task",
      data.code || 500,
      data
    );
  }

  console.log(`[Kie:Market:${requestId}] ✓ Task created: ${data.data.taskId}`);
  return data.data.taskId;
}

/**
 * Poll for Market task result
 */
export async function waitForMarketResult(
  apiKey: string,
  taskId: string,
  timeoutMs: number = 180000 // 3 minutes
): Promise<{ resultUrls: string[]; duration: number }> {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  let attempts = 0;

  console.log(`[Kie:Market:${requestId}] Polling task: ${taskId}`);

  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    
    const response = await fetch(
      `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Kie:Market:${requestId}] Poll error:`, response.status, text);
      throw new KieApiError(
        `Failed to poll task status: ${response.status}`,
        response.status,
        text
      );
    }

    const data: MarketRecordInfoResponse = await response.json();
    
    console.log(`[Kie:Market:${requestId}] Attempt ${attempts}: state=${data.data.state}`);

    if (data.data.state === "success") {
      if (!data.data.resultJson) {
        throw new KieApiError("Task succeeded but no resultJson", 500, data);
      }

      // Parse resultJson string
      const result = JSON.parse(data.data.resultJson);
      const resultUrls = result.resultUrls || result.result_urls || [];

      if (!Array.isArray(resultUrls) || resultUrls.length === 0) {
        throw new KieApiError("No result URLs in response", 500, result);
      }

      const duration = Date.now() - startTime;
      console.log(`[Kie:Market:${requestId}] ✓ Success after ${duration}ms: ${resultUrls.length} URL(s)`);

      return { resultUrls, duration };
    }

    if (data.data.state === "fail") {
      const errorMsg = data.data.failMsg || "Task failed";
      console.error(`[Kie:Market:${requestId}] ❌ Task failed: ${errorMsg}`);
      throw new KieApiError(errorMsg, 502, data);
    }

    // Still processing (waiting, queuing, generating)
    await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds
  }

  // Timeout
  const duration = Date.now() - startTime;
  console.error(`[Kie:Market:${requestId}] ❌ Timeout after ${duration}ms`);
  throw new KieApiError(
    `Task timed out after ${Math.round(duration / 1000)}s`,
    504,
    { taskId, attempts }
  );
}

/**
 * Full Market inference flow
 */
export async function inferMarket(
  apiKey: string,
  model: string,
  input: Record<string, any>
): Promise<{ urls: string[]; taskId: string; duration: number }> {
  const taskId = await createMarketTask(apiKey, model, input);
  const { resultUrls, duration } = await waitForMarketResult(apiKey, taskId);
  
  return {
    urls: resultUrls,
    taskId,
    duration,
  };
}

// ============================================
// Veo API (Veo 3.1)
// ============================================

interface VeoGenerateRequest {
  prompt: string;
  model: "veo3";
  aspectRatio?: "16:9" | "9:16" | "1:1";
}

interface VeoGenerateResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface VeoRecordInfoResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    successFlag: number; // 1 = success, 0 = processing/waiting, -1 = failed
    response?: {
      resultUrls: string[];
    };
    errorMsg?: string;
  };
}

/**
 * Create Veo generation task
 */
export async function createVeoTask(
  apiKey: string,
  prompt: string,
  aspectRatio: string = "16:9"
): Promise<string> {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[Kie:Veo:${requestId}] Creating Veo task`);

  const payload: VeoGenerateRequest = {
    prompt,
    model: "veo3",
    aspectRatio: aspectRatio as any,
  };

  console.log(`[Kie:Veo:${requestId}] Request payload:`, JSON.stringify(payload, null, 2));

  const response = await fetch("https://api.kie.ai/api/v1/veo/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[Kie:Veo:${requestId}] HTTP error:`, response.status, text);
    throw new KieApiError(
      `Veo API returned ${response.status}`,
      response.status,
      text
    );
  }

  const data: VeoGenerateResponse = await response.json();
  console.log(`[Kie:Veo:${requestId}] Response:`, JSON.stringify(data, null, 2));

  if (data.code !== 200 || !data.data?.taskId) {
    console.error(`[Kie:Veo:${requestId}] Invalid response:`, data);
    throw new KieApiError(
      data.msg || "Failed to create Veo task",
      data.code || 500,
      data
    );
  }

  console.log(`[Kie:Veo:${requestId}] ✓ Task created: ${data.data.taskId}`);
  return data.data.taskId;
}

/**
 * Poll for Veo task result
 */
export async function waitForVeoResult(
  apiKey: string,
  taskId: string,
  timeoutMs: number = 180000 // 3 minutes
): Promise<{ resultUrls: string[]; duration: number }> {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  let attempts = 0;

  console.log(`[Kie:Veo:${requestId}] Polling task: ${taskId}`);

  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    
    const response = await fetch(
      `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Kie:Veo:${requestId}] Poll error:`, response.status, text);
      throw new KieApiError(
        `Failed to poll Veo status: ${response.status}`,
        response.status,
        text
      );
    }

    const data: VeoRecordInfoResponse = await response.json();
    
    console.log(`[Kie:Veo:${requestId}] Attempt ${attempts}: successFlag=${data.data.successFlag}`);

    if (data.data.successFlag === 1) {
      // Success
      const resultUrls = data.data.response?.resultUrls || [];

      if (!Array.isArray(resultUrls) || resultUrls.length === 0) {
        throw new KieApiError("No result URLs in Veo response", 500, data);
      }

      const duration = Date.now() - startTime;
      console.log(`[Kie:Veo:${requestId}] ✓ Success after ${duration}ms: ${resultUrls.length} URL(s)`);

      return { resultUrls, duration };
    }

    if (data.data.successFlag === -1) {
      // Failed
      const errorMsg = data.data.errorMsg || "Veo task failed";
      console.error(`[Kie:Veo:${requestId}] ❌ Task failed: ${errorMsg}`);
      throw new KieApiError(errorMsg, 502, data);
    }

    // Still processing (successFlag === 0)
    await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds
  }

  // Timeout
  const duration = Date.now() - startTime;
  console.error(`[Kie:Veo:${requestId}] ❌ Timeout after ${duration}ms`);
  throw new KieApiError(
    `Veo task timed out after ${Math.round(duration / 1000)}s`,
    504,
    { taskId, attempts }
  );
}

/**
 * Full Veo inference flow
 */
export async function inferVeo(
  apiKey: string,
  prompt: string,
  aspectRatio: string = "16:9"
): Promise<{ urls: string[]; taskId: string; duration: number }> {
  const taskId = await createVeoTask(apiKey, prompt, aspectRatio);
  const { resultUrls, duration } = await waitForVeoResult(apiKey, taskId);
  
  return {
    urls: resultUrls,
    taskId,
    duration,
  };
}

// ============================================
// Mock Inference (for testing)
// ============================================

export async function mockInfer(
  modelId: string,
  prompt: string
): Promise<{ urls: string[]; taskId: string; duration: number }> {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[Kie:Mock:${requestId}] 🎭 Mock inference for ${modelId}`);
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const mockTaskId = `mock_${requestId}_${Date.now()}`;
  const mockUrl = modelId.includes("video") 
    ? "https://placehold.co/1920x1080/video/mp4"
    : "https://placehold.co/1024x1024/png";
  
  console.log(`[Kie:Mock:${requestId}] ✓ Returning mock URL: ${mockUrl}`);
  
  return {
    urls: [mockUrl],
    taskId: mockTaskId,
    duration: 2000,
  };
}
