/**
 * API key format validation utilities
 * Uses loose validation (prefix checks only) to avoid false positives
 */

export type ApiProvider = "openrouter" | "openai" | "anthropic" | "google";

/**
 * Validate API key format by checking prefix only
 * Returns true if valid, false otherwise
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
 * Get user-friendly error message for invalid key format
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
