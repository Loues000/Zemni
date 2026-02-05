import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelUsage } from "ai";

export interface ProviderResult {
  text: string;
  usage: LanguageModelUsage;
  costInUsd: number;
}

export interface StreamResult {
  textStream: AsyncIterable<string>;
  usage: Promise<LanguageModelUsage>;
  costInUsd: Promise<number>;
}


/**
 * Create an OpenAI provider exposing methods to generate full responses or stream responses incrementally.
 *
 * @param apiKey - The OpenAI API key used to initialize the provider client.
 * @returns An object with:
 *  - `generateText(modelId, messages, options)`: generates a complete response and returns `{ text, usage, costInUsd }`.
 *  - `streamText(modelId, messages, options)`: returns `{ textStream, getUsage() }` where `textStream` is an AsyncIterable of text chunks and `getUsage()` consumes the stream to produce `{ text, usage, costInUsd }` (usage is estimated after stream consumption). Cost values are returned as `0`.
 */
export function createOpenAIProvider(apiKey: string) {
  const openai = createOpenAI({ apiKey });

  function getModelId(fullModelId: string): string {
    // Extract model name from openai/gpt-4o format
    const parts = fullModelId.split("/");
    return parts.length > 1 ? parts[1] : fullModelId;
  }


  return {
    async generateText(
      modelId: string,
      messages: Array<{ role: string; content: string }>,
      options: { maxTokens?: number; temperature?: number; maxRetries?: number } = {}
    ): Promise<ProviderResult> {
      const model = openai(getModelId(modelId));

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
      const model = openai(getModelId(modelId));

      const stream = await streamText({
        model: model as any,
        messages: messages as any,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      });

      return {
        textStream: stream.textStream,
        getUsage: async () => {
          // Wait for stream to complete to get usage
          const chunks: string[] = [];
          for await (const chunk of stream.textStream) {
            chunks.push(chunk);
          }

          // Note: streamText doesn't directly expose usage, we'll need to track tokens separately
          // For now, return estimated usage based on text length
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

export type OpenAIProvider = ReturnType<typeof createOpenAIProvider>;