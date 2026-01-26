import { useState, useEffect, useMemo } from "react";
import type { OutputEntry, OutputKind } from "@/types";
import { sortOutputsByDate, filterOutputsByKind, outputsToRecord } from "@/lib/utils/output-helpers";

export interface UseOutputManagementReturn {
  outputs: Record<string, OutputEntry>;
  setOutputs: React.Dispatch<React.SetStateAction<Record<string, OutputEntry>>>;
  selectedTabId: string | null;
  setSelectedTabId: (id: string | null) => void;
  secondTabId: string | null;
  setSecondTabId: (id: string | null) => void;
  generatingTabId: string | null;
  setGeneratingTabId: (id: string | null) => void;
  outputTabs: OutputEntry[];
  outputsForMode: OutputEntry[];
  outputsForModeRecord: Record<string, OutputEntry>;
  currentOutput: OutputEntry | undefined;
  secondOutput: OutputEntry | undefined;
  isSplitView: boolean;
  setIsEditing: (editing: boolean) => void;
  setIsEditingSecond: (editing: boolean) => void;
}

/**
 * Manages output tabs, selection, and split view logic
 */
export function useOutputManagement(
  outputKind: OutputKind,
  setIsEditing: (editing: boolean) => void,
  setIsEditingSecond: (editing: boolean) => void
): UseOutputManagementReturn {
  const [outputs, setOutputs] = useState<Record<string, OutputEntry>>({});
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [secondTabId, setSecondTabId] = useState<string | null>(null);
  const [generatingTabId, setGeneratingTabId] = useState<string | null>(null);

  const outputTabs = useMemo(() => {
    return sortOutputsByDate(Object.values(outputs));
  }, [outputs]);

  const outputsForMode = useMemo(() => {
    return filterOutputsByKind(outputTabs, outputKind);
  }, [outputTabs, outputKind]);

  const outputsForModeRecord = useMemo(() => {
    return outputsToRecord(outputsForMode);
  }, [outputsForMode]);

  const currentOutput = selectedTabId ? outputs[selectedTabId] : undefined;
  const secondOutput = secondTabId ? outputs[secondTabId] : undefined;
  const isSplitView = secondTabId !== null;

  useEffect(() => {
    if (outputsForMode.length === 0) {
      setSelectedTabId(null);
      setSecondTabId(null);
      return;
    }

    if (!selectedTabId || !outputsForMode.some((t) => t.id === selectedTabId)) {
      setSelectedTabId(outputsForMode[0].id);
    }

    setSecondTabId(null);
    setIsEditing(false);
    setIsEditingSecond(false);
  }, [outputKind, outputsForMode, selectedTabId, setIsEditing, setIsEditingSecond]);

  return {
    outputs,
    setOutputs,
    selectedTabId,
    setSelectedTabId,
    secondTabId,
    setSecondTabId,
    generatingTabId,
    setGeneratingTabId,
    outputTabs,
    outputsForMode,
    outputsForModeRecord,
    currentOutput,
    secondOutput,
    isSplitView,
    setIsEditing,
    setIsEditingSecond
  };
}
