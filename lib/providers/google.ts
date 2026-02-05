import { generateText, streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelUsage } from "ai";
import type { ProviderResult } from "./openai";


/**
 * Create a Google Generative AI provider configured with the provided API key.
 *
 * The returned provider exposes `generateText` for one-shot text generation and `streamText` for streaming generation with a post-hoc usage calculator.
 *
 * @param apiKey - API key used to authenticate requests to Google Generative AI
 * @returns An object with:
 *   - `generateText(modelId, messages, options)`: generates text for `modelId` given `messages` and returns a `ProviderResult` containing `text`, `usage`, and `costInUsd` (0).
 *   - `streamText(modelId, messages, options)`: returns `{ textStream, getUsage }` where `textStream` is an `AsyncIterable<string>` of chunks and `getUsage()` drains the stream to produce a `ProviderResult` with the full `text`, an estimated `usage` (prompt/completion/total tokens), and `costInUsd` (0).
 */
export function createGoogleProvider(apiKey: string) {
  const google = createGoogleGenerativeAI({ apiKey });

  function getModelId(fullModelId: string): string {
    // Extract model name from google/gemini-1.5-pro format
    const parts = fullModelId.split("/");
    return parts.length > 1 ? parts[1] : fullModelId;
  }


  return {
    async generateText(
      modelId: string,
      messages: Array<{ role: string; content: string }>,
      options: { maxTokens?: number; temperature?: number; maxRetries?: number } = {}
    ): Promise<ProviderResult> {
      const model = google(getModelId(modelId));

      const result = await generateText({
        model: model as any,
        messages: messages as any,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        maxRetries: options.maxRetries,
      });

      return {
        text: result.text,
        usage: result.usage,
        costInUsd: 0,
      };
    },

    async streamText(
      modelId: string,
      messages: Array<{ role: string; content: string }>,
      options: { maxTokens?: number; temperature?: number } = {}
    ): Promise<{ textStream: AsyncIterable<string>; getUsage: () => Promise<ProviderResult> }> {
      const model = google(getModelId(modelId));

      const stream = await streamText({
        model: model as any,
        messages: messages as any,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      });

      return {
        textStream: stream.textStream,
        getUsage: async () => {
          const chunks: string[] = [];
          for await (const chunk of stream.textStream) {
            chunks.push(chunk);
          }

          const fullText = chunks.join("");
          const estimatedCompletionTokens = Math.ceil(fullText.length / 4);
          const estimatedPromptTokens = messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0);

          const usage: LanguageModelUsage = {
            promptTokens: estimatedPromptTokens,
            completionTokens: estimatedCompletionTokens,
            totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
          };

          return {
            text: fullText,
            usage,
            costInUsd: 0,
          };
        },
      };
    },
  };
}

export type GoogleProvider = ReturnType<typeof createGoogleProvider>;