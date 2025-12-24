/**
 * Kie.ai API Client V2
 * 
 * Supports:
 * - Market API (Seedream, Nano Banana Edit, etc.)
 * - Veo API (Veo 3.1)
 */

export class KieApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = "KieApiError";
  }
}

// ============================================
// Market API (Seedream, Nano Banana, etc.)
// ============================================

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
    resultJson?: string; // JSON string containing resultUrls
    failMsg?: string;
  };
}

/**
 * Create task in Market API
 */
export async function marketCreateTask(
  apiKey: string,
  model: string,
  input: Record<string, any>
): Promise<string> {
  const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      callBackUrl: null,
      input,
    }),
  });

  if (!response.ok) {
    throw new KieApiError(
      `Market API HTTP error: ${response.statusText}`,
      response.status
    );
  }

  const data: MarketCreateTaskResponse = await response.json();

  if (data.code !== 200 || !data.data?.taskId) {
    throw new KieApiError(
      data.msg || "Failed to create task",
      data.code,
      data
    );
  }

  return data.data.taskId;
}

/**
 * Poll Market task until complete
 */
export async function marketPollTask(
  apiKey: string,
  taskId: string,
  timeoutMs: number = 180000
): Promise<string[]> {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < timeoutMs) {
    const response = await fetch(
      `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new KieApiError(
        `Market API HTTP error: ${response.statusText}`,
        response.status
      );
    }

    const data: MarketRecordInfoResponse = await response.json();

    if (data.code !== 200) {
      throw new KieApiError(data.msg || "Failed to get record info", data.code);
    }

    const { state, resultJson, failMsg } = data.data;

    console.log(`[Kie Market] Task ${taskId} state: ${state}`);

    if (state === "fail") {
      throw new KieApiError(failMsg || "Task failed", 500);
    }

    if (state === "success") {
      if (!resultJson) {
        throw new KieApiError("No resultJson in success response", 500);
      }

      try {
        const result = JSON.parse(resultJson);
        const urls = result.resultUrls || result.result_urls || [];
        
        if (!Array.isArray(urls) || urls.length === 0) {
          throw new KieApiError("No result URLs found", 500);
        }

        return urls;
      } catch (error) {
        throw new KieApiError(
          `Failed to parse resultJson: ${error instanceof Error ? error.message : String(error)}`,
          500
        );
      }
    }

    // Still processing, wait and retry
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new KieApiError("Task timeout", 504);
}

/**
 * Market API: Create task and wait for result
 */
export async function marketInfer(
  apiKey: string,
  model: string,
  input: Record<string, any>,
  timeoutMs: number = 180000
): Promise<{ urls: string[]; taskId: string; duration: number }> {
  const startTime = Date.now();

  console.log(`[Kie Market] Creating task for model: ${model}`);
  const taskId = await marketCreateTask(apiKey, model, input);
  
  console.log(`[Kie Market] Task created: ${taskId}, polling...`);
  const urls = await marketPollTask(apiKey, taskId, timeoutMs);
  
  const duration = Date.now() - startTime;
  console.log(`[Kie Market] Task complete in ${duration}ms, ${urls.length} URL(s)`);

  return { urls, taskId, duration };
}

// ============================================
// Veo API (Veo 3.1)
// ============================================

interface VeoGenerateResponse {
  code: number;
  msg: string;
  data: {
    task_id: string;
  };
}

interface VeoRecordInfoResponse {
  code: number;
  message: string;
  data: {
    successFlag: number; // 1 = success, 0 = processing/failed
    response?: {
      resultUrls?: string[];
    };
    errorMessage?: string;
  };
}

/**
 * Generate video with Veo API
 */
export async function veoGenerate(
  apiKey: string,
  prompt: string,
  model: string = "veo3",
  aspectRatio: string = "16:9"
): Promise<string> {
  const response = await fetch("https://api.kie.ai/api/v1/veo/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      model,
      aspectRatio,
    }),
  });

  if (!response.ok) {
    throw new KieApiError(
      `Veo API HTTP error: ${response.statusText}`,
      response.status
    );
  }

  const data: VeoGenerateResponse = await response.json();

  if (data.code !== 200 || !data.data?.task_id) {
    throw new KieApiError(
      data.msg || "Failed to generate video",
      data.code,
      data
    );
  }

  return data.data.task_id;
}

/**
 * Poll Veo task until complete
 */
export async function veoPollTask(
  apiKey: string,
  taskId: string,
  timeoutMs: number = 180000
): Promise<string[]> {
  const startTime = Date.now();
  const pollInterval = 3000; // 3 seconds (video takes longer)

  while (Date.now() - startTime < timeoutMs) {
    const response = await fetch(
      `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new KieApiError(
        `Veo API HTTP error: ${response.statusText}`,
        response.status
      );
    }

    const data: VeoRecordInfoResponse = await response.json();

    if (data.code !== 200) {
      throw new KieApiError(
        data.message || "Failed to get record info",
        data.code
      );
    }

    const { successFlag, response: veoResponse, errorMessage } = data.data;

    console.log(`[Kie Veo] Task ${taskId} successFlag: ${successFlag}`);

    if (successFlag === 1 && veoResponse?.resultUrls) {
      const urls = veoResponse.resultUrls;

      if (!Array.isArray(urls) || urls.length === 0) {
        throw new KieApiError("No result URLs found", 500);
      }

      return urls;
    }

    if (successFlag === 0 && errorMessage) {
      throw new KieApiError(errorMessage, 500);
    }

    // Still processing, wait and retry
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new KieApiError("Video generation timeout", 504);
}

/**
 * Veo API: Generate video and wait for result
 */
export async function veoInfer(
  apiKey: string,
  prompt: string,
  model: string = "veo3",
  aspectRatio: string = "16:9",
  timeoutMs: number = 180000
): Promise<{ urls: string[]; taskId: string; duration: number }> {
  const startTime = Date.now();

  console.log(`[Kie Veo] Generating video with model: ${model}`);
  const taskId = await veoGenerate(apiKey, prompt, model, aspectRatio);
  
  console.log(`[Kie Veo] Task created: ${taskId}, polling...`);
  const urls = await veoPollTask(apiKey, taskId, timeoutMs);
  
  const duration = Date.now() - startTime;
  console.log(`[Kie Veo] Video complete in ${duration}ms, ${urls.length} URL(s)`);

  return { urls, taskId, duration };
}

