import type { OutputKind, OutputEntry } from "@/types";
import type { SummaryHandlersContext } from "./summary-handlers";

interface CreateSummaryContextProps {
  currentKind: OutputKind;
  currentSummary: string;
  selectedTabId: string | null;
  currentOutput: OutputEntry | undefined;
  isSmallScreen: boolean;
  setStatus: (status: any) => void;
  setMobileView: (view: "input" | "output") => void;
  setLoadedFromHistory: (loaded: boolean) => void;
  setIsEditing: (editing: boolean) => void;
  refineTargetRef: React.MutableRefObject<string>;
  setData: (data: any[]) => void;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  setError: (error: string) => void;
  setCopySuccess: (success: boolean) => void;
  editDraft: string;
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
 * Creates the summary handlers context
 */
export function createSummaryContext(props: CreateSummaryContextProps): SummaryHandlersContext {
  return {
    currentKind: props.currentKind,
    currentSummary: props.currentSummary,
    selectedTabId: props.selectedTabId,
    currentOutput: props.currentOutput,
    isSmallScreen: props.isSmallScreen,
    setStatus: props.setStatus,
    setMobileView: props.setMobileView,
    setLoadedFromHistory: props.setLoadedFromHistory,
    setIsEditing: props.setIsEditing,
    refineTargetRef: props.refineTargetRef,
    setData: props.setData,
    handleSubmit: props.handleSubmit,
    setError: props.setError,
    currentSummaryText: props.currentSummary,
    setCopySuccess: props.setCopySuccess,
    editDraft: props.editDraft,
    currentSummaryForEdit: props.currentSummary,
    setEditDraft: props.setEditDraft,
    setOutputs: props.setOutputs,
    secondSummary: props.secondSummary,
    secondTabId: props.secondTabId,
    secondOutput: props.secondOutput,
    setIsEditingSecond: props.setIsEditingSecond,
    editDraftSecond: props.editDraftSecond,
    setEditDraftSecond: props.setEditDraftSecond,
    setCopySuccessSecond: props.setCopySuccessSecond
  };
}
