/**
 * Retries a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryableErrors?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    retryableErrors = (error: Error) => {
      // Retry on network errors, timeouts, and 5xx errors
      const message = error.message.toLowerCase();
      return (
        message.includes("timeout") ||
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("500") ||
        message.includes("502") ||
        message.includes("503") ||
        message.includes("504")
      );
    }
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === maxRetries || !retryableErrors(lastError)) {
        throw lastError;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError || new Error("Retry failed");
}

/**
 * Checks if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("abort")
  );
}
