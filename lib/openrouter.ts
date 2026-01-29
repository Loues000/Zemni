import { createOpenAI } from "@ai-sdk/openai";

const defaultApiKey = process.env.OPENROUTER_API_KEY;

/**
 * Create OpenRouter client with optional API key
 * If apiKey is provided, use it; otherwise use the default system key
 */
export function createOpenRouterClient(apiKey?: string) {
  const key = apiKey || defaultApiKey;
  
  if (!key) {
    throw new Error("OpenRouter API key is required");
  }

  return createOpenAI({
    apiKey: key,
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3420",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Summary Maker"
    }
  });
}

// Default export for backward compatibility
export const openrouter = createOpenRouterClient();
