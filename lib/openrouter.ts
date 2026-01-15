import { createOpenAI } from "@ai-sdk/openai";

const apiKey = process.env.OPENROUTER_API_KEY;

export const openrouter = createOpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  headers: {
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3420",
    "X-Title": process.env.OPENROUTER_APP_NAME ?? "Summary Maker"
  }
});
