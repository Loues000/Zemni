import { generateText, streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelUsage } from "ai";
import type { ProviderResult } from "./openai";


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
      const model = google(getModelId(modelId));

      const stream = await streamText({
        model,
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
