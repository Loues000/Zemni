import { createOpenAI } from "@ai-sdk/openai";
import OpenAI from "openai";

const defaultApiKey = process.env.OPENROUTER_API_KEY;

/**
 * Create OpenRouter client with optional API key using AI SDK
 * If apiKey is provided, use it; otherwise use the default system key
 */
export function createOpenRouterClient(apiKey?: string) {
  const key = apiKey || defaultApiKey;
  
  if (!key) {
    throw new Error("OpenRouter API key is required");
  }

  console.log('[OpenRouter] API key length:', key.length);
  console.log('[OpenRouter] API key format:', key.substring(0, 10) + '...');
  console.log('[OpenRouter] Creating AI SDK client with baseURL:', 'https://openrouter.ai/api/v1');

  return createOpenAI({
    apiKey: key,
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3420",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Summary Maker"
    }
  });
}

/**
 * Create OpenRouter client using native OpenAI SDK (bypass AI SDK)
 * This may fix authentication issues with custom baseURLs
 */
export function createOpenRouterNativeClient(apiKey?: string) {
  const key = apiKey || defaultApiKey;
  
  if (!key) {
    throw new Error("OpenRouter API key is required");
  }

  return new OpenAI({
    apiKey: key,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3420",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Summary Maker"
    }
  });
}

// Default export for backward compatibility
export const openrouter = createOpenRouterClient();
