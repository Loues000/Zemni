import { generateText, streamText } from "ai";
import { createOpenAIProvider } from "./openai";
import { createAnthropicProvider } from "./anthropic";
import { createGoogleProvider } from "./google";
import { createOpenRouterClient, createOpenRouterNativeClient } from "../openrouter";
import type { LanguageModelUsage } from "ai";
import type { ProviderResult } from "./openai";

export type ApiProvider = "openrouter" | "openai" | "anthropic" | "google";

export interface ProviderInfo {
  provider: ApiProvider;
  key: string;
  isOwnKey: boolean;
}


/**
 * Determine the API provider implied by a model identifier in the form "provider/model".
 *
 * @param modelId - Model identifier expected to include a provider prefix (e.g., "openai/gpt-4o").
 * @returns The inferred ApiProvider (`"openai"`, `"anthropic"`, `"google"`, or `"openrouter"`) if recognized, `null` otherwise.
 */
export function getProviderFromModelId(modelId: string): ApiProvider | null {
  const parts = modelId.split("/");
  if (parts.length < 2) return null;

  const provider = parts[0].toLowerCase() as any;

  if (provider === "openai") return "openai";
  if (provider === "anthropic") return "anthropic";
  if (provider === "google") return "google";
  if (provider === "openrouter" || provider === "x-ai" || provider === "mistral" ||
    provider === "meta" || provider === "nvidia" || provider === "microsoft" ||
    provider === "amazon" || provider === "cohere") {
    return "openrouter";
  }

  return null;
}

/**
 * Selects the API key to use for a given model identifier from a list of available provider keys.
 *
 * @param modelId - The model identifier (may include provider prefix like `provider/model`)
 * @param apiKeys - Available provider keys to choose from
 * @returns The selected ProviderInfo if a suitable owned key is found, or `null` if none is available
 */
export function getProviderForModel(modelId: string, apiKeys: ProviderInfo[]): ProviderInfo | null {
  const modelProvider = getProviderFromModelId(modelId);

  // If OpenRouter key exists, it can access all models
  const openRouterKey = apiKeys.find(k => k.provider === "openrouter" && k.isOwnKey);
  if (openRouterKey) {
    return openRouterKey;
  }

  // Check for provider-specific keys
  if (modelProvider && modelProvider !== "openrouter") {
    const providerKey = apiKeys.find(k => k.provider === modelProvider && k.isOwnKey);
    if (providerKey) {
      return providerKey;
    }
  }

  return null;
}

/**
 * Extracts the model identifier from a full model string.
 *
 * @param fullModelId - A model string in either "provider/model" format or a bare model name
 * @returns The model segment (the substring after the first '/'), or `fullModelId` unchanged if no '/' is present
 */
function getModelId(fullModelId: string): string {
  const parts = fullModelId.split("/");
  return parts.length > 1 ? parts[1] : fullModelId;
}

/**
 * Map a model identifier to the corresponding model name for the specified provider.
 *
 * @param modelId - Full or namespaced model identifier or base model name (e.g., "provider/model" or "model")
 * @param provider - Target provider for which the model name should be mapped
 * @returns The provider-specific model name if a mapping exists, otherwise the original base model name
 */
function mapModelName(modelId: string, provider: ApiProvider): string {
  const model = getModelId(modelId);

  // Provider-specific model name mappings
  const modelMaps: Record<ApiProvider, Record<string, string>> = {
    anthropic: {
      "claude-sonnet-4.5": "claude-sonnet-4-5",
      "claude-opus-4.5": "claude-opus-4-5",
    },
    openai: {
      "gpt-5.2-chat": "gpt-5.2-chat-latest",
      "gpt-5.2": "gpt-5.2-2025-12-11",
      "gpt-5.1": "gpt-5.1-2025-11-13",
      "gpt-5-mini": "gpt-5-mini-2025-08-07",
      "gpt-oss-120b:free": "gpt-oss-120b",
      "gpt-oss-120b": "gpt-oss-120b",
      "gpt-oss-20b:free": "gpt-oss-20b",
    },
    google: {
      "gemini-3-flash-preview": "gemini-3-flash-preview",
      "gemini-3-pro-preview": "gemini-3-pro-preview",
    },
    openrouter: {
      // OpenRouter uses the same names as OpenRouter (no mapping needed)
    },
  };

  const modelMap = modelMaps[provider];
  if (modelMap && modelMap[model]) {
    return modelMap[model];
  }

  // Return original name if no mapping exists
  return model;
}

/**
 * Normalize a full model identifier to its base model name.
 *
 * @param modelId - A full model identifier like "provider/model" or a bare model name.
 * @returns The base model name (the segment after the first '/'), or the original `modelId` if no '/' is present.
 */
function getEffectiveModelId(modelId: string): string {
  return getModelId(modelId);
}


/**
 * Creates a provider-agnostic interface for text generation and streaming using the given provider credentials.
 *
 * @param providerInfo - Information about the provider to create (provider type, API key, and ownership flag)
 * @returns An object with `generateText` and `streamText` functions that invoke the selected provider using the provided credentials. `generateText` produces a ProviderResult containing `text`, `usage`, and `costInUsd`. `streamText` returns a streaming interface exposing `textStream` and a `getUsage()` method that resolves to a ProviderResult after the stream completes.
 */
export function createProvider(providerInfo: ProviderInfo) {
  switch (providerInfo.provider) {
    case "openai": {
      const provider = createOpenAIProvider(providerInfo.key);
      return {
        generateText: (modelId: string, messages: any[], options: any) =>
          provider.generateText(mapModelName(modelId, "openai"), messages, options),
        streamText: (modelId: string, messages: any[], options: any) =>
          provider.streamText(mapModelName(modelId, "openai"), messages, options),
      };
    }

    case "anthropic": {
      const provider = createAnthropicProvider(providerInfo.key);
      return {
        generateText: (modelId: string, messages: any[], options: any) =>
          provider.generateText(mapModelName(modelId, "anthropic"), messages, options),
        streamText: (modelId: string, messages: any[], options: any) =>
          provider.streamText(mapModelName(modelId, "anthropic"), messages, options),
      };
    }

    case "google": {
      const provider = createGoogleProvider(providerInfo.key);
      return {
        generateText: (modelId: string, messages: any[], options: any) =>
          provider.generateText(mapModelName(modelId, "google"), messages, options),
        streamText: (modelId: string, messages: any[], options: any) =>
          provider.streamText(mapModelName(modelId, "google"), messages, options),
      };
    }
    case "openrouter":
    default:
      // For OpenRouter, use the existing client
      return {
        generateText: async (
          modelId: string,
          messages: Array<{ role: string; content: string }>,
          options: { maxTokens?: number; temperature?: number; maxRetries?: number } = {}
        ): Promise<ProviderResult> => {
          const client = createOpenRouterClient(providerInfo.key);
          const result = await generateText({
            model: client(modelId) as any,
            messages: messages as any,
            maxTokens: options.maxTokens,
            temperature: options.temperature,
            maxRetries: options.maxRetries,
          });
          return {
            text: result.text,
            usage: result.usage,
            costInUsd: 0, // Will be calculated separately based on model pricing
          };
        },
        streamText: async (
          modelId: string,
          messages: Array<{ role: string; content: string }>,
          options: { maxTokens?: number; temperature?: number } = {}
        ) => {
          const client = createOpenRouterClient(providerInfo.key);
          const stream = await streamText({
            model: client(modelId) as any,
            messages: messages as any,
            maxTokens: options.maxTokens,
            temperature: options.temperature,
          });

          return {
            textStream: stream.textStream,
            getUsage: async () => {
              const res = await stream.text;
              return {
                text: res,
                usage: stream.usage as any,
                costInUsd: 0,
              };
            }
          };
        }
      };
  }
}

/**
 * Produces model output for the given messages by selecting an appropriate API key and invoking the matching provider.
 *
 * @param modelId - Full or namespaced model identifier (for example, "provider/model-name")
 * @param messages - Array of conversation messages, each with a `role` and `content`
 * @param apiKeys - Available provider keys and their metadata used to choose which provider to call
 * @param options - Generation options such as `maxTokens`, `temperature`, and `maxRetries`
 * @returns A ProviderResult containing the generated text, usage metrics, and cost information
 * @throws Error when no API key is available for the requested model
 */
export async function generateWithProvider(
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  apiKeys: ProviderInfo[],
  options: { maxTokens?: number; temperature?: number; maxRetries?: number } = {}
): Promise<ProviderResult> {
  const providerInfo = getProviderForModel(modelId, apiKeys);

  if (!providerInfo) {
    throw new Error(`No API key available for model ${modelId}`);
  }

  const provider = createProvider(providerInfo);
  return provider.generateText(modelId, messages, options);
}

/**
 * Stream text from the provider selected for the given model using the available API keys.
 *
 * @param modelId - The model identifier to use (may include provider prefix, e.g., `openai/gpt-4`).
 * @param messages - Conversation messages to send to the model, each with a `role` and `content`.
 * @param apiKeys - Available provider API keys and metadata used to select which provider to call.
 * @param options - Generation options such as `maxTokens` and `temperature`.
 * @returns An object with `textStream`, an async iterable that yields text chunks as they arrive, and `getUsage`, a function that returns the provider's final `ProviderResult` (aggregated text, usage, and cost).
 */
export async function streamWithProvider(
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  apiKeys: ProviderInfo[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<{ textStream: AsyncIterable<string>; getUsage: () => Promise<ProviderResult> }> {
  const providerInfo = getProviderForModel(modelId, apiKeys);

  if (!providerInfo) {
    throw new Error(`No API key available for model ${modelId}`);
  }

  const provider = createProvider(providerInfo);
  return provider.streamText(modelId, messages, options as any);
}