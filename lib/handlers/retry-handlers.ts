import type { OutputEntry } from "@/types";
import { handleGenerate, type GenerationHandlersContext } from "./generation-handlers";

/**
 * Retries generation for a failed output entry
 */
export const handleRetryGeneration = async (
  tabId: string,
  context: GenerationHandlersContext,
  outputs: Record<string, OutputEntry>
): Promise<void> => {
  const failedOutput = outputs[tabId];
  if (!failedOutput || !failedOutput.error || !failedOutput.canRetry) {
    return;
  }

  // Clear the error and retry
  const retryContext: GenerationHandlersContext = {
    ...context,
    selectedTabId: tabId
  };

  // Clear error state before retrying
  context.setOutputs((prev) => {
    const existing = prev[tabId];
    if (!existing) return prev;
    return {
      ...prev,
      [tabId]: {
        ...existing,
        error: undefined,
        canRetry: undefined,
        isGenerating: true
      }
    };
  });

  await handleGenerate(retryContext);
};
