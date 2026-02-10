import { useState, useMemo, useEffect, useRef, ReactNode } from "react";
import { IconX } from "../ui/Icons";
import type { HistoryEntry } from "@/types";
import { ALL_FOLDERS, DEFAULT_FOLDER_LABEL, UNSORTED_FOLDER, normalizeFolder } from "@/lib/history-folders";

type ContextMenuState = {
  entry: HistoryEntry;
  x: number;
  y: number;
};

interface HistorySidebarProps {
  isOpen: boolean;
  history: HistoryEntry[];
  currentHistoryId: string | null;
  onClose: () => void;
  onSelectEntry: (entry: HistoryEntry) => void;
  onDeleteEntry: (id: string, event?: React.MouseEvent) => void;
  folderNames: string[];
  selectedFolder: string;
  onFolderChange: (folder: string) => void;
  onExportEntry?: (entry: HistoryEntry) => void;
  onMoveEntry?: (id: string, folder: string | null) => void;
  footer?: ReactNode;
}

/**
 * Sidebar listing history entries with search and grouping.
 */
export function HistorySidebar({
  isOpen,
  history,
  currentHistoryId,
  onClose,
  onSelectEntry,
  onDeleteEntry,
  folderNames,
  selectedFolder,
  onFolderChange,
  onExportEntry,
  onMoveEntry,
  footer
}: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedFolder === ALL_FOLDERS || selectedFolder === UNSORTED_FOLDER) return;
    if (!folderNames.includes(selectedFolder)) {
      onFolderChange(ALL_FOLDERS);
    }
  }, [folderNames, onFolderChange, selectedFolder]);

  const filteredHistory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const searchFiltered = !query
      ? history
      : history.filter((entry) => {
          const folderName = normalizeFolder(entry.folder);
          return (
            entry.title.toLowerCase().includes(query) ||
            entry.fileName.toLowerCase().includes(query) ||
            (entry.exportedSubject && entry.exportedSubject.toLowerCase().includes(query)) ||
            (folderName && folderName.toLowerCase().includes(query))
          );
        });

    if (selectedFolder === ALL_FOLDERS) return searchFiltered;
    if (selectedFolder === UNSORTED_FOLDER) {
      return searchFiltered.filter((entry) => !normalizeFolder(entry.folder));
    }

    return searchFiltered.filter((entry) => normalizeFolder(entry.folder) === selectedFolder);
  }, [history, searchQuery, selectedFolder]);

  useEffect(() => {
    if (!contextMenu) return;

    const onPointerDown = (e: PointerEvent) => {
      const menu = menuRef.current;
      if (!menu) return;
      if (!menu.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };

    const onScroll = () => setContextMenu(null);

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [contextMenu]);

  const openContextMenu = (entry: HistoryEntry, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 240;
    const menuHeight = 360;
    const x = Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8));
    const y = Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8));

    setContextMenu({
      entry,
      x,
      y,
    });
  };

  const handleMoveToFolder = (folder: string | null) => {
    if (!contextMenu?.entry || !onMoveEntry) return;
    onMoveEntry(contextMenu.entry.id, folder);
    setContextMenu(null);
  };

  const handleCreateFolder = () => {
    if (!contextMenu?.entry || !onMoveEntry) return;
    const name = window.prompt("New folder name");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    onMoveEntry(contextMenu.entry.id, trimmed);
    setContextMenu(null);
  };
  /**
   * Group history entries into time buckets for display.
   */
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
              <div className="history-folders">
                <div className="history-folders-header">Folders</div>
                <div className="history-folder-list">
                  <button
                    type="button"
                    className={`history-folder-btn${selectedFolder === ALL_FOLDERS ? " active" : ""}`}
                    onClick={() => onFolderChange(ALL_FOLDERS)}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`history-folder-btn${selectedFolder === UNSORTED_FOLDER ? " active" : ""}`}
                    onClick={() => onFolderChange(UNSORTED_FOLDER)}
                  >
                    {DEFAULT_FOLDER_LABEL}
                  </button>
                  {folderNames.map((folder) => (
                    <button
                      key={folder}
                      type="button"
                      className={`history-folder-btn${selectedFolder === folder ? " active" : ""}`}
                      onClick={() => onFolderChange(folder)}
                    >
                      {folder}
                    </button>
                  ))}
                </div>
              </div>
              {filteredHistory.length === 0 ? (
                <p className="hint">No results found.</p>
              ) : (
                <div className="history-groups">
                  {groupHistoryByTime(filteredHistory).map(([groupLabel, entries]) => (
                    <div key={groupLabel}>
                      <h3 className="history-group-title">{groupLabel}</h3>
                      <ul className="history-list">
                        {entries.map((entry) => {
                          const folderLabel = normalizeFolder(entry.folder);
                          const metaParts = [];
                          if (entry.exportedSubject) metaParts.push(entry.exportedSubject);
                          if (folderLabel) metaParts.push(`Folder: ${folderLabel}`);
                          const metaLine = metaParts.join(" · ");
                          return (
                            <li
                              key={entry.id}
                              className={`history-item${entry.id === currentHistoryId ? " active" : ""}`}
                              onClick={() => onSelectEntry(entry)}
                              onContextMenu={(e) => openContextMenu(entry, e)}
                              aria-haspopup="menu"
                            >
                              <div className="history-item-content">
                                <strong>{entry.title}</strong>
                                {metaLine ? <span className="meta">{metaLine}</span> : null}
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
                          );
                        })}
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
      {contextMenu ? (
        <div
          ref={menuRef}
          className="history-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
          aria-label="History actions"
        >
          <button
            type="button"
            className="history-context-item"
            role="menuitem"
            onClick={() => {
              onSelectEntry(contextMenu.entry);
              setContextMenu(null);
            }}
          >
            Open
          </button>
          {onExportEntry ? (
            <button
              type="button"
              className="history-context-item"
              role="menuitem"
              onClick={() => {
                onExportEntry(contextMenu.entry);
                setContextMenu(null);
              }}
            >
              Export ZIP
            </button>
          ) : null}
          {onMoveEntry ? (
            <>
              <div className="history-context-divider" />
              <div className="history-context-label">Move to folder</div>
              <button
                type="button"
                className={`history-context-item${!normalizeFolder(contextMenu.entry.folder) ? " active" : ""}`}
                role="menuitem"
                onClick={() => handleMoveToFolder(null)}
              >
                {DEFAULT_FOLDER_LABEL}
              </button>
              {folderNames.map((folder) => (
                <button
                  key={folder}
                  type="button"
                  className={`history-context-item${normalizeFolder(contextMenu.entry.folder) === folder ? " active" : ""}`}
                  role="menuitem"
                  onClick={() => handleMoveToFolder(folder)}
                >
                  {folder}
                </button>
              ))}
              <button
                type="button"
                className="history-context-item"
                role="menuitem"
                onClick={handleCreateFolder}
              >
                New folder...
              </button>
            </>
          ) : null}
          <div className="history-context-divider" />
          <button
            type="button"
            className="history-context-item danger"
            role="menuitem"
            onClick={() => {
              onDeleteEntry(contextMenu.entry.id);
              setContextMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </>
  );
}
