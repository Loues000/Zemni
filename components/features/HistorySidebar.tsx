import { useState, useMemo, ReactNode } from "react";
import { IconX } from "../ui/Icons";
import type { HistoryEntry } from "@/types";

interface HistorySidebarProps {
  isOpen: boolean;
  history: HistoryEntry[];
  currentHistoryId: string | null;
  onClose: () => void;
  onSelectEntry: (entry: HistoryEntry) => void;
  onDeleteEntry: (id: string, event: React.MouseEvent) => void;
  footer?: ReactNode;
}

export function HistorySidebar({
  isOpen,
  history,
  currentHistoryId,
  onClose,
  onSelectEntry,
  onDeleteEntry,
  footer
}: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const query = searchQuery.toLowerCase();
    return history.filter(
      (entry) =>
        entry.title.toLowerCase().includes(query) ||
        entry.fileName.toLowerCase().includes(query) ||
        (entry.exportedSubject && entry.exportedSubject.toLowerCase().includes(query))
    );
  }, [history, searchQuery]);
  const groupHistoryByTime = (entries: HistoryEntry[]): Array<[string, HistoryEntry[]]> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekAgo = todayStart - 7 * 24 * 60 * 60 * 1000;

    const groups: Record<string, HistoryEntry[]> = {
      Today: [],
      Yesterday: [],
      "Last week": [],
      Older: []
    };

    entries.forEach((entry) => {
      const t = entry.updatedAt;
      if (t >= todayStart) groups.Today.push(entry);
      else if (t >= yesterdayStart) groups.Yesterday.push(entry);
      else if (t >= weekAgo) groups["Last week"].push(entry);
      else groups.Older.push(entry);
    });

    return Object.entries(groups).filter(([, entries]) => entries.length > 0);
  };

  return (
    <>
      <div className={`sidebar-backdrop${isOpen ? " visible" : ""}`} onClick={onClose} />
      <aside className={`sidebar${isOpen ? " open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-left">
            <h1 className="sidebar-title">Zemni</h1>
            <span className="sidebar-subtitle">History</span>
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <IconX />
          </button>
        </div>
        <div className="sidebar-content">
          {history.length === 0 ? (
            <p className="hint">No history yet.</p>
          ) : (
            <>
              <div className="wave-group">
                <input
                  type="text"
                  className={`input history-search-input${searchQuery ? " has-value" : ""}`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="bar"></span>
                <label className="label">
                  <span className="label-char" style={{ "--index": 0 } as React.CSSProperties}>S</span>
                  <span className="label-char" style={{ "--index": 1 } as React.CSSProperties}>e</span>
                  <span className="label-char" style={{ "--index": 2 } as React.CSSProperties}>a</span>
                  <span className="label-char" style={{ "--index": 3 } as React.CSSProperties}>r</span>
                  <span className="label-char" style={{ "--index": 4 } as React.CSSProperties}>c</span>
                  <span className="label-char" style={{ "--index": 5 } as React.CSSProperties}>h</span>
                </label>
              </div>
              {filteredHistory.length === 0 ? (
                <p className="hint">No results found.</p>
              ) : (
                <div className="history-groups">
                  {groupHistoryByTime(filteredHistory).map(([groupLabel, entries]) => (
                    <div key={groupLabel}>
                      <h3 className="history-group-title">{groupLabel}</h3>
                      <ul className="history-list">
                        {entries.map((entry) => (
                          <li
                            key={entry.id}
                            className={`history-item${entry.id === currentHistoryId ? " active" : ""}`}
                            onClick={() => onSelectEntry(entry)}
                          >
                            <div className="history-item-content">
                              <strong>{entry.title}</strong>
                              {entry.exportedSubject && (
                                <span className="meta">{entry.exportedSubject}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="history-delete"
                              onClick={(e) => onDeleteEntry(entry.id, e)}
                              aria-label="Delete entry"
                            >
                              <IconX />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {footer && <div className="sidebar-footer">{footer}</div>}
      </aside>
    </>
  );
}
