"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconSettings } from "./Icons";

type QuickSettingsMenuProps = {
  theme: string;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  wrapperClassName?: string;
  buttonClassName?: string;
  menuClassName?: string;
  label?: string;
  showLabel?: boolean;
};

/**
 * Shared quick settings menu (theme toggle + link to full settings).
 */
export function QuickSettingsMenu({
  theme,
  onToggleTheme,
  onOpenSettings,
  wrapperClassName = "settings-float",
  buttonClassName = "icon-btn settings-btn",
  menuClassName = "settings-popover",
  label = "Settings",
  showLabel = false,
}: QuickSettingsMenuProps) {
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

  return (
    <div className={wrapperClassName} ref={rootRef}>
      <button
        id={buttonId}
        type="button"
        className={buttonClassName}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open quick settings"
        aria-expanded={open}
        title="Quick settings"
      >
        <IconSettings />
        {showLabel ? <span className="input-bar-btn-label">{label}</span> : null}
      </button>
      {open ? (
        <div className={menuClassName} role="menu" aria-labelledby={buttonId}>
          <div className="settings-popover-section">Quick settings</div>
          <button
            type="button"
            className="settings-popover-item"
            role="menuitem"
            onClick={() => {
              onToggleTheme();
            }}
          >
            <span>Theme</span>
            <span className="settings-popover-meta">{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
          <button
            type="button"
            className="settings-popover-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            <span>Settings</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
