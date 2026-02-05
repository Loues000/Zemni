/**
 * API key format validation utilities
 * Uses loose validation (prefix checks only) to avoid false positives
 */

export type ApiProvider = "openrouter" | "openai" | "anthropic" | "google";

/**
 * Check whether an API key matches a provider's expected prefix and basic length requirements.
 *
 * @param provider - The API provider whose expected key prefix is used ("openrouter", "openai", "anthropic", or "google").
 * @param key - The API key to validate; whitespace is trimmed and a minimum length of 10 characters is required.
 * @returns `true` if the key passes the provider-specific prefix check and length requirement (`true` for unknown providers), `false` otherwise.
 */
export function validateApiKeyFormat(provider: ApiProvider, key: string): boolean {
  if (!key || typeof key !== "string") {
    return false;
  }

  const trimmedKey = key.trim();
  if (trimmedKey.length < 10) {
    return false; // Minimum length check
  }

  // Loose validation: only check prefix
  switch (provider) {
    case "openrouter":
      return trimmedKey.startsWith("sk-or-v1-");
    
    case "openai":
      return trimmedKey.startsWith("sk-");
    
    case "anthropic":
      return trimmedKey.startsWith("sk-ant-");
    
    case "google":
      return trimmedKey.startsWith("AIza");
    
    default:
      return true; // Unknown provider, allow
  }
}

/**
 * Return a provider-specific user-facing message explaining the expected API key prefix.
 *
 * @param provider - The API provider to tailor the message for
 * @returns A human-readable error message describing the expected key prefix for `provider`; returns a generic invalid-format message for unknown providers
 */
export function getValidationErrorMessage(provider: ApiProvider): string {
  switch (provider) {
    case "openrouter":
      return "Invalid OpenRouter key format. Keys should start with 'sk-or-v1-'";
    case "openai":
      return "Invalid OpenAI key format. Keys should start with 'sk-'";
    case "anthropic":
      return "Invalid Anthropic key format. Keys should start with 'sk-ant-'";
    case "google":
      return "Invalid Google key format. Keys should start with 'AIza'";
    default:
      return "Invalid API key format";
  }
}