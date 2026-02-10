"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconFolder } from "./Icons";
import { ALL_FOLDERS, DEFAULT_FOLDER_LABEL, UNSORTED_FOLDER } from "@/lib/history-folders";

type FolderMenuProps = {
  folders: string[];
  selectedFolder: string;
  onSelectFolder: (folder: string) => void;
  onCreateFolder?: (name: string) => void;
  onOpenSidebar?: () => void;
  variant?: "input" | "icon";
  label?: string;
  buttonClassName?: string;
  menuClassName?: string;
  showAll?: boolean;
  showUnsorted?: boolean;
};

/**
 * Folder filter menu for history organization.
 */
export function FolderMenu({
  folders,
  selectedFolder,
  onSelectFolder,
  onCreateFolder,
  onOpenSidebar,
  variant = "input",
  label = "Folders",
  buttonClassName,
  menuClassName,
  showAll = false,
  showUnsorted = true,
}: FolderMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleSelect = (folder: string) => {
    onSelectFolder(folder);
    onOpenSidebar?.();
    setOpen(false);
  };

  const handleCreateFolder = () => {
    if (!onCreateFolder) return;
    const name = window.prompt("New folder name");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateFolder(trimmed);
    handleSelect(trimmed);
  };

  const buttonClass =
    buttonClassName ||
    (variant === "icon" ? "icon-btn folder-menu-btn" : "input-bar-btn folder-menu-btn");

  return (
    <div className="folder-menu" ref={rootRef}>
      <button
        id={buttonId}
        type="button"
        className={buttonClass}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <IconFolder />
        {variant === "input" ? <span className="input-bar-btn-label">{label}</span> : null}
      </button>
      {open ? (
        <div className={`folder-menu-panel${menuClassName ? ` ${menuClassName}` : ""}`} role="menu" aria-labelledby={buttonId}>
          <div className="folder-menu-header">Folders</div>
          {showAll && (
            <button
              type="button"
              className={`folder-menu-item${selectedFolder === ALL_FOLDERS ? " active" : ""}`}
              role="menuitem"
              onClick={() => handleSelect(ALL_FOLDERS)}
            >
              All
            </button>
          )}
          {showUnsorted && (
            <button
              type="button"
              className={`folder-menu-item${selectedFolder === UNSORTED_FOLDER ? " active" : ""}`}
              role="menuitem"
              onClick={() => handleSelect(UNSORTED_FOLDER)}
            >
              {DEFAULT_FOLDER_LABEL}
            </button>
          )}
          {folders.map((folder) => (
            <button
              key={folder}
              type="button"
              className={`folder-menu-item${selectedFolder === folder ? " active" : ""}`}
              role="menuitem"
              onClick={() => handleSelect(folder)}
            >
              {folder}
            </button>
          ))}
          {onCreateFolder ? (
            <>
              <div className="folder-menu-divider" />
              <button
                type="button"
                className="folder-menu-item"
                role="menuitem"
                onClick={handleCreateFolder}
              >
                New folder...
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
