import { IconClose } from "../ui/Icons";
import type { OutputEntry } from "@/types";

interface OutputTabsProps {
  outputs: Record<string, OutputEntry>;
  selectedTabId: string | null;
  secondTabId: string | null;
  generatingTabId: string | null;
  showSplitHint?: boolean;
  onTabChange: (tabId: string, event?: React.MouseEvent) => void;
  onCloseTab: (tabId: string, event: React.MouseEvent) => void;
}

export function OutputTabs({
  outputs,
  selectedTabId,
  secondTabId,
  generatingTabId,
  showSplitHint = true,
  onTabChange,
  onCloseTab
}: OutputTabsProps) {
  const outputTabs = Object.values(outputs).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="output-tabs">
      {outputTabs.length === 0 ? (
        <span className="hint">No output yet</span>
      ) : (
        outputTabs.map((tab) => {
          const isActive = tab.id === selectedTabId;
          const isSecond = tab.id === secondTabId;
          const canSplit = outputTabs.length > 1 && !isActive;
          return (
            <div
              key={tab.id}
              className={
                "output-tab" + 
                (isActive ? " active" : "") + 
                (isSecond ? " split-active" : "") +
                (tab.isGenerating ? " generating" : "")
              }
              onClick={(e) => onTabChange(tab.id, e)}
              title={showSplitHint && canSplit ? "Ctrl+Click for split view" : undefined}
            >
              <span className="output-tab-label">{tab.label}</span>
              <button
                type="button"
                className="output-tab-close"
                onClick={(e) => onCloseTab(tab.id, e)}
                title="Delete output"
                aria-label="Delete output"
              >
                <IconClose />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
