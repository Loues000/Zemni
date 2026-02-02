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
        model,
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
        model,
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
