import { createOpenAI } from "@ai-sdk/openai";
import OpenAI from "openai";

const defaultApiKey = process.env.OPENROUTER_API_KEY;

/**
 * Create an OpenRouter-configured OpenAI client, using the provided API key or the default environment key.
 *
 * @param apiKey - Optional API key to use; if omitted the `OPENROUTER_API_KEY` environment variable will be used.
 * @returns An OpenAI client configured with OpenRouter's base URL and default headers (`HTTP-Referer` and `X-Title`).
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

/**
 * Create an OpenRouter-compatible OpenAI client using the native OpenAI SDK.
 *
 * @param apiKey - Optional OpenRouter API key. If omitted, the `OPENROUTER_API_KEY` environment variable is used.
 * @returns An OpenAI client instance configured to use the OpenRouter API base URL and default headers.
 * @throws Error if no API key is provided either via `apiKey` or the `OPENROUTER_API_KEY` environment variable.
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