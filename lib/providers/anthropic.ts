import { generateText, streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelUsage } from "ai";
import type { ProviderResult } from "./openai";


export function createAnthropicProvider(apiKey: string) {
  const anthropic = createAnthropic({ apiKey });

  function getModelId(fullModelId: string): string {
    // Extract model name from anthropic/claude-3-sonnet format
    const parts = fullModelId.split("/");
    return parts.length > 1 ? parts[1] : fullModelId;
  }


  return {
    async generateText(
      modelId: string,
      messages: Array<{ role: string; content: string }>,
      options: { maxTokens?: number; temperature?: number; maxRetries?: number; signal?: AbortSignal } = {}
    ): Promise<ProviderResult> {
      const model = anthropic(getModelId(modelId));

      const result = await generateText({
        model: model as any,
        messages: messages as any,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        maxRetries: options.maxRetries,
        abortSignal: options.signal,
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
      options: { maxTokens?: number; temperature?: number; signal?: AbortSignal } = {}
    ): Promise<{ textStream: AsyncIterable<string>; getUsage: () => Promise<ProviderResult> }> {
      const model = anthropic(getModelId(modelId));

      const stream = await streamText({
        model: model as any,
        messages: messages as any,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        abortSignal: options.signal,
      });

      const chunks: string[] = [];
      const textStream = (async function* () {
        for await (const chunk of stream.textStream) {
          chunks.push(chunk);
          yield chunk;
        }
      })();

      return {
        textStream,
        getUsage: async () => {
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

export type AnthropicProvider = ReturnType<typeof createAnthropicProvider>;
