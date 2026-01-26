import type { OutputEntry, OutputKind } from "@/types";

export interface TabHandlersContext {
  outputKind: OutputKind;
  selectedTabId: string | null;
  secondTabId: string | null;
  outputs: Record<string, OutputEntry>;
  outputTabs: OutputEntry[];
  setSelectedTabId: (id: string | null) => void;
  setSecondTabId: (id: string | null) => void;
  setSelectedModel: (modelId: string) => void;
  setIsEditing: (editing: boolean) => void;
  setIsEditingSecond: (editing: boolean) => void;
  setError: (error: string) => void;
  setMessages: (messages: any[]) => void;
  setInput: (input: string) => void;
  setData: (data: any[]) => void;
  generatingTabId: string | null;
  setTabToDelete: (id: string | null) => void;
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, OutputEntry>>>;
}

/**
 * Handles tab selection change, including split view (Ctrl/Cmd+Click)
 */
export const handleTabChange = (
  tabId: string,
  context: TabHandlersContext,
  event?: React.MouseEvent
): void => {
  const {
    outputKind,
    selectedTabId,
    secondTabId,
    outputs,
    setSelectedTabId,
    setSecondTabId,
    setSelectedModel,
    setIsEditing,
    setIsEditingSecond,
    setError,
    setMessages,
    setInput,
    setData,
    generatingTabId
  } = context;

  const isCtrlClick = outputKind === "summary" && event && (event.ctrlKey || event.metaKey);
  
  if (isCtrlClick && selectedTabId) {
    if (tabId === selectedTabId) return;
    if (tabId === secondTabId) {
      setSecondTabId(selectedTabId);
      setSelectedTabId(tabId);
      const tab = outputs[tabId];
      if (tab) setSelectedModel(tab.modelId);
      return;
    }
    setSecondTabId(tabId);
    return;
  }
  
  if (tabId === secondTabId) {
    setSecondTabId(null);
  }
  
  setSelectedTabId(tabId);
  setIsEditing(false);
  setIsEditingSecond(false);
  const tab = outputs[tabId];
  if (tab) setSelectedModel(tab.modelId);
  if (!generatingTabId || tabId !== generatingTabId) {
    setError("");
    setMessages([]);
    setInput("");
    setData([]);
  }
};

/**
 * Initiates tab close confirmation
 */
export const handleCloseTabRequest = (
  tabId: string,
  event: React.MouseEvent,
  setTabToDelete: (id: string | null) => void
): void => {
  event.stopPropagation();
  setTabToDelete(tabId);
};

/**
 * Confirms and closes a tab
 */
export const handleCloseTabConfirm = (
  tabId: string,
  context: TabHandlersContext
): void => {
  const {
    secondTabId,
    selectedTabId,
    outputTabs,
    setTabToDelete,
    setSecondTabId,
    setSelectedTabId,
    setOutputs,
    setIsEditing,
    setIsEditingSecond
  } = context;

  setTabToDelete(null);
  
  if (tabId === secondTabId) {
    setSecondTabId(null);
  }
  
  if (tabId === selectedTabId) {
    if (secondTabId) {
      setSelectedTabId(secondTabId);
      setSecondTabId(null);
    } else {
      const remainingTabs = outputTabs.filter(t => t.id !== tabId);
      setSelectedTabId(remainingTabs.length > 0 ? remainingTabs[0].id : null);
    }
  }
  
  setOutputs((prev) => {
    const newOutputs = { ...prev };
    delete newOutputs[tabId];
    return newOutputs;
  });
  
  setIsEditing(false);
  setIsEditingSecond(false);
};
