import { useCallback } from "react";
import type { SummaryHandlersContext } from "./summary-handlers";
import { handleRefineSubmit, handleCopySummary, handleCopySummarySecond, handleEditStart, handleEditSave, handleEditStartSecond, handleEditSaveSecond } from "./summary-handlers";

/**
 * Creates wrapper functions for summary handlers
 */
export function useSummaryWrappers(summaryContext: SummaryHandlersContext) {
  const handleCopySummaryWrapper = useCallback(async (): Promise<void> => {
    await handleCopySummary(summaryContext);
  }, [summaryContext]);

  const handleCopySummarySecondWrapper = useCallback(async (): Promise<void> => {
    await handleCopySummarySecond(summaryContext);
  }, [summaryContext]);

  const handleEditStartWrapper = useCallback((): void => {
    handleEditStart(summaryContext);
  }, [summaryContext]);

  const handleEditSaveWrapper = useCallback((): void => {
    handleEditSave(summaryContext);
  }, [summaryContext]);

  const handleEditStartSecondWrapper = useCallback((): void => {
    handleEditStartSecond(summaryContext);
  }, [summaryContext]);

  const handleEditSaveSecondWrapper = useCallback((): void => {
    handleEditSaveSecond(summaryContext);
  }, [summaryContext]);

  const handleRefineSubmitWrapper = useCallback((event: React.FormEvent<HTMLFormElement>): void => {
    handleRefineSubmit(event, summaryContext);
  }, [summaryContext]);

  return {
    handleCopySummaryWrapper,
    handleCopySummarySecondWrapper,
    handleEditStartWrapper,
    handleEditSaveWrapper,
    handleEditStartSecondWrapper,
    handleEditSaveSecondWrapper,
    handleRefineSubmitWrapper
  };
}
