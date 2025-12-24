/**
 * Generate N unique prompt variants using Anthropic API
 * 
 * Used by Split Grid to automatically create diverse prompts
 * when user provides only a single base prompt.
 */

import Anthropic from "@anthropic-ai/sdk";

/**
 * Generate N unique variants of a base prompt
 * 
 * @param basePrompt - The original prompt to create variants from
 * @param n - Number of variants to generate
 * @returns Array of N unique prompt strings
 */
export async function generatePromptVariants(
  basePrompt: string,
  n: number
): Promise<string[]> {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[LLM:generateVariants:${requestId}] Generating ${n} variants of: "${basePrompt.substring(0, 50)}..."`);

  // Validate inputs
  if (!basePrompt || basePrompt.trim().length === 0) {
    console.error(`[LLM:generateVariants:${requestId}] Empty base prompt`);
    throw new Error("Base prompt cannot be empty");
  }

  if (n <= 0) {
    console.error(`[LLM:generateVariants:${requestId}] Invalid count: ${n}`);
    throw new Error("Count must be positive");
  }

  // If only 1 variant needed, return base prompt
  if (n === 1) {
    console.log(`[LLM:generateVariants:${requestId}] ✓ Only 1 variant needed, returning base prompt`);
    return [basePrompt];
  }

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(`[LLM:generateVariants:${requestId}] ❌ ANTHROPIC_API_KEY missing`);
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

    const systemPrompt = `You are a creative AI prompt engineer. Your task is to generate diverse, high-quality variations of image generation prompts.`;

    const userPrompt = `Generate ${n} unique and diverse variations of this image generation prompt:

"${basePrompt}"

Requirements:
- Each variation should be meaningfully different but maintain the core concept
- Vary the style, mood, composition, lighting, or perspective
- Keep each prompt concise (1-2 sentences)
- Return ONLY a JSON array of strings, no additional text
- Format: ["variant 1", "variant 2", ...]

Generate exactly ${n} variations.`;

    console.log(`[LLM:generateVariants:${requestId}] Calling Anthropic (${model})...`);
    const startTime = Date.now();

    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      temperature: 0.9, // Higher temperature for more creativity
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const duration = Date.now() - startTime;
    console.log(`[LLM:generateVariants:${requestId}] ✓ Response received (${duration}ms)`);

    // Extract text from response
    const textContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as any).text)
      .join("\n");

    if (!textContent) {
      throw new Error("No text in Anthropic response");
    }

    console.log(`[LLM:generateVariants:${requestId}] Response length: ${textContent.length} chars`);

    // Try to parse as JSON
    let variants: string[];

    try {
      // Remove any markdown code blocks
      const jsonText = textContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const parsed = JSON.parse(jsonText);

      if (Array.isArray(parsed)) {
        variants = parsed.filter((v) => typeof v === "string" && v.trim().length > 0);
        console.log(`[LLM:generateVariants:${requestId}] ✓ Parsed JSON: ${variants.length} variants`);
      } else {
        throw new Error("Parsed result is not an array");
      }
    } catch (parseError) {
      console.warn(`[LLM:generateVariants:${requestId}] ⚠️  JSON parse failed, trying line-by-line extraction`);

      // Fallback: extract lines
      variants = textContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => {
          // Filter out empty lines, JSON syntax, and markdown
          return (
            line.length > 0 &&
            !line.startsWith("[") &&
            !line.startsWith("]") &&
            !line.startsWith("{") &&
            !line.startsWith("}") &&
            !line.startsWith("```") &&
            line !== ","
          );
        })
        .map((line) => {
          // Remove quotes and trailing commas
          return line.replace(/^["']|["'],?$/g, "").trim();
        })
        .filter((line) => line.length > 0);

      console.log(`[LLM:generateVariants:${requestId}] ✓ Extracted ${variants.length} lines`);
    }

    // Ensure we have exactly N variants
    if (variants.length < n) {
      console.warn(`[LLM:generateVariants:${requestId}] ⚠️  Only got ${variants.length}/${n} variants, padding...`);

      // Pad with base prompt variations
      while (variants.length < n) {
        const index = variants.length + 1;
        variants.push(`${basePrompt} (variant ${index})`);
      }
    } else if (variants.length > n) {
      console.log(`[LLM:generateVariants:${requestId}] ✓ Got ${variants.length} variants, trimming to ${n}`);
      variants = variants.slice(0, n);
    }

    console.log(`[LLM:generateVariants:${requestId}] ✅ Success! Generated ${variants.length} variants`);
    console.log(`[LLM:generateVariants:${requestId}] Token usage: input=${response.usage.input_tokens}, output=${response.usage.output_tokens}`);

    return variants;
  } catch (error) {
    console.error(`[LLM:generateVariants:${requestId}] ❌ Error:`, error);

    // Fallback: return base prompt N times with suffixes
    console.warn(`[LLM:generateVariants:${requestId}] Using fallback: base prompt with suffixes`);
    return Array.from({ length: n }, (_, i) => {
      if (i === 0) return basePrompt;
      return `${basePrompt} (variant ${i + 1})`;
    });
  }
}

