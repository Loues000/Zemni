import type { OutputEntry, OutputKind, Status } from "@/types";
import { enforceOutputFormat } from "@/lib/format-output";

export interface SummaryHandlersContext {
  currentKind: OutputKind;
  currentSummary: string;
  selectedTabId: string | null;
  currentOutput: OutputEntry | undefined;
  isSmallScreen: boolean;
  setStatus: (status: Status) => void;
  setMobileView: (view: "input" | "output") => void;
  setLoadedFromHistory: (loaded: boolean) => void;
  setIsEditing: (editing: boolean) => void;
  refineTargetRef: React.MutableRefObject<string>;
  setData: (data: any[]) => void;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>, options?: any) => void;
  setError: (error: string) => void;
  currentSummaryText: string;
  setCopySuccess: (success: boolean) => void;
  editDraft: string;
  currentSummaryForEdit: string;
  setEditDraft: (draft: string) => void;
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, OutputEntry>>>;
  secondSummary: string;
  secondTabId: string | null;
  secondOutput: OutputEntry | undefined;
  setIsEditingSecond: (editing: boolean) => void;
  editDraftSecond: string;
  setEditDraftSecond: (draft: string) => void;
  setCopySuccessSecond: (success: boolean) => void;
}

/**
 * Handles copying summary to clipboard
 */
export const handleCopySummary = async (
  context: SummaryHandlersContext
): Promise<void> => {
  const { currentSummaryText, setCopySuccess } = context;
  if (!currentSummaryText) return;
  
  try {
    await navigator.clipboard.writeText(currentSummaryText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  } catch (err) {
    const textArea = document.createElement("textarea");
    textArea.value = currentSummaryText;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (e) {
      // Ignore
    }
    document.body.removeChild(textArea);
  }
};

/**
 * Handles copying second summary to clipboard (split view)
 */
export const handleCopySummarySecond = async (
  context: SummaryHandlersContext
): Promise<void> => {
  const { secondSummary, setCopySuccessSecond } = context;
  if (!secondSummary) return;
  
  try {
    await navigator.clipboard.writeText(secondSummary);
    setCopySuccessSecond(true);
    setTimeout(() => setCopySuccessSecond(false), 2000);
  } catch (err) {
    const textArea = document.createElement("textarea");
    textArea.value = secondSummary;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      setCopySuccessSecond(true);
      setTimeout(() => setCopySuccessSecond(false), 2000);
    } catch (e) {
      // Ignore
    }
    document.body.removeChild(textArea);
  }
};

/**
 * Starts editing mode for summary
 */
export const handleEditStart = (context: SummaryHandlersContext): void => {
  const { currentSummaryForEdit, setEditDraft, setIsEditing } = context;
  setEditDraft(currentSummaryForEdit);
  setIsEditing(true);
};

/**
 * Starts editing mode for second summary (split view)
 */
export const handleEditStartSecond = (context: SummaryHandlersContext): void => {
  const { secondSummary, setEditDraftSecond, setIsEditingSecond } = context;
  setEditDraftSecond(secondSummary);
  setIsEditingSecond(true);
};

/**
 * Saves edited summary
 */
export const handleEditSave = (context: SummaryHandlersContext): void => {
  const {
    selectedTabId,
    currentOutput,
    editDraft,
    currentSummaryForEdit,
    setOutputs,
    setLoadedFromHistory,
    setIsEditing
  } = context;

  if (!selectedTabId || !currentOutput || editDraft === currentSummaryForEdit) {
    setIsEditing(false);
    return;
  }
  setOutputs((prev) => ({
    ...prev,
    [selectedTabId]: {
      ...currentOutput,
      summary: editDraft,
      updatedAt: Date.now()
    }
  }));
  setLoadedFromHistory(false);
  setIsEditing(false);
};

/**
 * Saves edited second summary (split view)
 */
export const handleEditSaveSecond = (context: SummaryHandlersContext): void => {
  const {
    secondTabId,
    secondOutput,
    editDraftSecond,
    secondSummary,
    setOutputs,
    setLoadedFromHistory,
    setIsEditingSecond
  } = context;

  if (!secondTabId || !secondOutput || editDraftSecond === secondSummary) {
    setIsEditingSecond(false);
    return;
  }
  setOutputs((prev) => ({
    ...prev,
    [secondTabId]: {
      ...secondOutput,
      summary: editDraftSecond,
      updatedAt: Date.now()
    }
  }));
  setLoadedFromHistory(false);
  setIsEditingSecond(false);
};

/**
 * Handles refine form submission
 */
export const handleRefineSubmit = (
  event: React.FormEvent<HTMLFormElement>,
  context: SummaryHandlersContext
): void => {
  event.preventDefault();
  const {
    currentKind,
    currentSummaryForEdit,
    selectedTabId,
    currentOutput,
    setStatus,
    isSmallScreen,
    setMobileView,
    setLoadedFromHistory,
    setIsEditing,
    refineTargetRef,
    setData,
    handleSubmit,
    setError
  } = context;

  if (currentKind !== "summary" || !currentSummaryForEdit || !selectedTabId || !currentOutput) {
    setError("No summary available.");
    setStatus("error");
    return;
  }
  setStatus("refining");
  if (isSmallScreen) setMobileView("output");
  setLoadedFromHistory(false);
  setIsEditing(false);
  refineTargetRef.current = selectedTabId;
  setData([]);
  handleSubmit(event, {
    body: {
      summary: currentSummaryForEdit,
      modelId: currentOutput.modelId
    }
  });
};
