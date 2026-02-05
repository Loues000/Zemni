import { generateText, streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelUsage } from "ai";
import type { ProviderResult } from "./openai";


/**
 * Creates an Anthropic text provider configured with the given API key.
 *
 * The returned provider exposes two methods for interacting with Anthropic models:
 * - `generateText(modelId, messages, options)`: produces a completed response and returns its text, usage, and `costInUsd: 0`.
 * - `streamText(modelId, messages, options)`: returns `{ textStream, getUsage }` where `textStream` is an `AsyncIterable<string>` of streamed chunks and `getUsage` consumes the stream to produce the full text, an estimated token usage (prompt, completion, total), and `costInUsd: 0`.
 *
 * @param apiKey - The Anthropic API key used to construct the client.
 * @returns An object exposing `generateText` and `streamText` methods for calling Anthropic models.
 */
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
      options: { maxTokens?: number; temperature?: number; maxRetries?: number } = {}
    ): Promise<ProviderResult> {
      const model = anthropic(getModelId(modelId));

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
      const model = anthropic(getModelId(modelId));

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

export type AnthropicProvider = ReturnType<typeof createAnthropicProvider>;