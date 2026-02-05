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

/**
 * Render a horizontal list of output tabs with selection, split-view hint, and close controls.
 *
 * @param outputs - Map of output entries keyed by ID; used to build the list of tabs.
 * @param selectedTabId - ID of the currently active tab, or `null` if none.
 * @param secondTabId - ID of the tab shown in the secondary/split position, or `null` if none.
 * @param generatingTabId - ID of the tab currently generating output, or `null` if none.
 * @param showSplitHint - Whether to show the "Ctrl+Click for split view" hint on splittable tabs (default `true`).
 * @param onTabChange - Callback invoked when a tab is clicked; receives the tab ID and the mouse event.
 * @param onCloseTab - Callback invoked when a tab's close button is clicked; receives the tab ID and the mouse event.
 *
 * @returns The rendered React element containing the output tabs or an empty-state message when there are no outputs.
 */
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
        <span className="output-tabs-empty">No output yet</span>
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
              <span className="output-tab-label">
                {tab.label}
                {tab.isCached && (
                  <span className="cache-indicator" title="Loaded from cache">💾</span>
                )}
                {tab.error && tab.canRetry && (
                  <span className="error-retry-indicator" title="Error - Click to retry">⚠️</span>
                )}
              </span>
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