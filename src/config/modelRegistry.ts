/**
 * Model Registry - Centralized configuration for all AI models
 * 
 * This registry defines all available AI models and providers.
 * To add a new model:
 * 1. Add model definition to MODEL_REGISTRY
 * 2. Implement inference logic in /api/infer
 * 3. Update paramsSchema for model-specific parameters
 */

export type Capability = "text" | "image" | "video" | "edit" | "upscale";

export type Provider = "kie-market" | "kie-veo" | "anthropic";

export interface ParamSchema {
  type: "number" | "string" | "boolean";
  default?: any;
  min?: number;
  max?: number;
  options?: string[];
}

export interface ModelDef {
  id: string;
  title: string;
  provider: Provider;
  capability: Capability;
  enabled: boolean;
  creditCost: number;
  paramsSchema: Record<string, ParamSchema>;
  kieModel?: string; // Kie.ai model name
  kieProvider?: "market" | "veo"; // Kie.ai API endpoint
}

/**
 * Model Registry
 * 
 * Fully implemented models:
 * - anthropic_text (Anthropic)
 * - seedream_image (Kie Market)
 * - nano_banana_edit (Kie Market)
 * - veo3_video (Kie Veo)
 */
export const MODEL_REGISTRY: ModelDef[] = [
  // Text Generation Models
  {
    id: "anthropic_text",
    title: "Anthropic (Text)",
    provider: "anthropic",
    capability: "text",
    enabled: true,
    creditCost: 2,
    paramsSchema: {
      temperature: {
        type: "number",
        default: 0.7,
        min: 0,
        max: 1,
      },
      max_tokens: {
        type: "number",
        default: 800,
        min: 1,
        max: 4096,
      },
    },
  },
  
  // Image Generation Models
  {
    id: "seedream_image",
    title: "Seedream (Image)",
    provider: "kie-market",
    capability: "image",
    enabled: true,
    creditCost: 8,
    kieModel: "bytedance/seedream",
    kieProvider: "market",
    paramsSchema: {
      image_size: {
        type: "string",
        default: "square_hd",
        options: ["square_hd", "square", "portrait", "landscape"],
      },
    },
  },
  
  // Image Edit Models
  {
    id: "nano_banana_edit",
    title: "Nano Banana Edit (Image)",
    provider: "kie-market",
    capability: "edit",
    enabled: true,
    creditCost: 8,
    kieModel: "google/nano-banana-edit",
    kieProvider: "market",
    paramsSchema: {
      image_size: {
        type: "string",
        default: "1:1",
        options: ["1:1", "16:9", "9:16", "4:3", "3:4"],
      },
      output_format: {
        type: "string",
        default: "png",
        options: ["png", "jpg"],
      },
    },
  },
  
  // Video Models
  {
    id: "veo3_video",
    title: "Veo 3.1 (Video)",
    provider: "kie-veo",
    capability: "video",
    enabled: true,
    creditCost: 25,
    kieModel: "veo3",
    kieProvider: "veo",
    paramsSchema: {
      aspectRatio: {
        type: "string",
        default: "16:9",
        options: ["16:9", "9:16", "1:1"],
      },
    },
  },
  
  // Disabled models (placeholders)
  {
    id: "midjourney_image",
    title: "Midjourney (Image)",
    provider: "kie-market",
    capability: "image",
    enabled: false,
    creditCost: 10,
    kieModel: "midjourney/v6",
    kieProvider: "market",
    paramsSchema: {},
  },
];

/**
 * Get all enabled models
 */
export function getEnabledModels(): ModelDef[] {
  return MODEL_REGISTRY.filter((m) => m.enabled);
}

/**
 * Get model by ID
 */
export function getModelById(id: string): ModelDef | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

/**
 * Get models by capability
 */
export function getModelsByCapability(capability: Capability): ModelDef[] {
  return MODEL_REGISTRY.filter((m) => m.capability === capability && m.enabled);
}

