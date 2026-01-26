export interface ErrorInfo {
  message: string;
  suggestion?: string;
  retryable: boolean;
}

/**
 * Formats error messages to be more user-friendly with actionable suggestions
 */
export function formatErrorMessage(error: unknown): string {
  const info = getErrorInfo(error);
  return info.message;
}

/**
 * Gets detailed error information including suggestions
 */
export function getErrorInfo(error: unknown): ErrorInfo {
  if (!(error instanceof Error)) {
    return {
      message: String(error) || "An unexpected error occurred.",
      suggestion: "Please try again. If the problem persists, try refreshing the page.",
      retryable: true
    };
  }

  const message = error.message.toLowerCase();
  const originalMessage = error.message;

  // Network errors
  if (message.includes("failed to fetch") || message.includes("networkerror")) {
    return {
      message: "Network connection failed.",
      suggestion: "Please check your internet connection and try again. If you're on a VPN, try disconnecting it.",
      retryable: true
    };
  }

  if (message.includes("timeout") || message.includes("abort")) {
    return {
      message: "Request timed out.",
      suggestion: "The server may be slow or overloaded. Try using a faster model (e.g., GPT-4o-mini) or reducing the document size.",
      retryable: true
    };
  }

  // API errors
  if (message.includes("500") || message.includes("internal server error")) {
    return {
      message: "Server error occurred.",
      suggestion: "This is usually temporary. Please wait a moment and try again.",
      retryable: true
    };
  }

  if (message.includes("502") || message.includes("bad gateway")) {
    return {
      message: "Service temporarily unavailable.",
      suggestion: "The service is experiencing issues. Please wait a moment and try again.",
      retryable: true
    };
  }

  if (message.includes("503") || message.includes("service unavailable")) {
    return {
      message: "Service is temporarily unavailable.",
      suggestion: "The service is down for maintenance. Please try again in a few minutes.",
      retryable: true
    };
  }

  if (message.includes("504") || message.includes("gateway timeout")) {
    return {
      message: "Request timed out.",
      suggestion: "Try using a faster model, reducing the document size, or splitting it into smaller sections.",
      retryable: true
    };
  }

  if (message.includes("429") || message.includes("too many requests")) {
    return {
      message: "Too many requests.",
      suggestion: "Please wait 30-60 seconds before trying again. Consider using a different model if available.",
      retryable: true
    };
  }

  if (message.includes("401") || message.includes("unauthorized")) {
    return {
      message: "Authentication failed.",
      suggestion: "Please check your API keys in the environment variables. Contact support if the problem persists.",
      retryable: false
    };
  }

  if (message.includes("403") || message.includes("forbidden")) {
    return {
      message: "Access denied.",
      suggestion: "Please check your permissions and API key configuration.",
      retryable: false
    };
  }

  if (message.includes("400") || message.includes("bad request")) {
    if (message.includes("missing")) {
      return {
        message: originalMessage,
        suggestion: "Please check that all required fields are filled.",
        retryable: false
      };
    }
    return {
      message: "Invalid request.",
      suggestion: "Please check your input and try again. If the problem persists, try a different document.",
      retryable: false
    };
  }

  // Model/API specific errors
  if (message.includes("invalid json") || message.includes("parse")) {
    return {
      message: "The model returned invalid data.",
      suggestion: "This can happen with some models. Please try again or use a different model.",
      retryable: true
    };
  }

  if (message.includes("model") && message.includes("not found")) {
    return {
      message: "The selected model is not available.",
      suggestion: "Please choose a different model from the dropdown.",
      retryable: false
    };
  }

  if (message.includes("rate limit") || message.includes("quota")) {
    return {
      message: "Rate limit exceeded.",
      suggestion: "Please wait a few minutes before trying again, or switch to a different model.",
      retryable: true
    };
  }

  // Generic fallback
  if (originalMessage.length < 100 && !originalMessage.includes("Error:")) {
    return {
      message: originalMessage,
      suggestion: "Please try again. If the problem persists, try a different model.",
      retryable: true
    };
  }

  return {
    message: "An error occurred.",
    suggestion: "Please try again. If the problem persists, try a different model or contact support.",
    retryable: true
  };
}

/**
 * Checks if an error is likely retryable
 */
export function isRetryableErrorMessage(error: unknown): boolean {
  return getErrorInfo(error).retryable;
}
