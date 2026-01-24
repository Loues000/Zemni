"use client";

import { useEffect, useId, useRef, useState } from "react";

type ExportOption = {
  id: string;
  label: string;
  onSelect: () => void;
};

type ExportMenuProps = {
  options: ExportOption[];
  disabled?: boolean;
  label?: string;
};

export function ExportMenu({ options, disabled, label = "Export" }: ExportMenuProps) {
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

  const isDisabled = disabled || options.length === 0;

  return (
    <div className="export-menu" ref={rootRef}>
      <button
        id={buttonId}
        type="button"
        className="btn btn-secondary btn-xs"
        onClick={() => setOpen((v) => !v)}
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label} <span aria-hidden="true">▾</span>
      </button>

      {open && !isDisabled ? (
        <div className="export-menu-panel" role="menu" aria-labelledby={buttonId}>
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="export-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                opt.onSelect();
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

