import { IconX } from "../ui/Icons";
import type { HistoryEntry } from "@/types";

interface HistorySidebarProps {
  isOpen: boolean;
  history: HistoryEntry[];
  currentHistoryId: string | null;
  onClose: () => void;
  onSelectEntry: (entry: HistoryEntry) => void;
  onDeleteEntry: (id: string, event: React.MouseEvent) => void;
}

export function HistorySidebar({
  isOpen,
  history,
  currentHistoryId,
  onClose,
  onSelectEntry,
  onDeleteEntry
}: HistorySidebarProps) {
  const groupHistoryByTime = (history: HistoryEntry[]): Array<[string, HistoryEntry[]]> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekAgo = todayStart - 7 * 24 * 60 * 60 * 1000;

    const groups: Record<string, HistoryEntry[]> = {
      Heute: [],
      Gestern: [],
      "Letzte Woche": [],
      Aelter: []
    };

    history.forEach((entry) => {
      const t = entry.updatedAt;
      if (t >= todayStart) groups.Heute.push(entry);
      else if (t >= yesterdayStart) groups.Gestern.push(entry);
      else if (t >= weekAgo) groups["Letzte Woche"].push(entry);
      else groups.Aelter.push(entry);
    });

    return Object.entries(groups).filter(([, entries]) => entries.length > 0);
  };

  return (
    <>
      <div className={`sidebar-backdrop${isOpen ? " visible" : ""}`} onClick={onClose} />
      <aside className={`sidebar${isOpen ? " open" : ""}`}>
        <div className="sidebar-header">
          <h2>Historie</h2>
          <button
            type="button"
            className="sidebar-close"
            onClick={onClose}
            aria-label="Sidebar schliessen"
          >
            <IconX />
          </button>
        </div>
        <div className="sidebar-content">
          {history.length === 0 ? (
            <p className="hint">Noch keine Eintraege.</p>
          ) : (
            <div className="history-groups">
              {groupHistoryByTime(history).map(([groupLabel, entries]) => (
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
                          aria-label="Eintrag loeschen"
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
        </div>
      </aside>
    </>
  );
}
