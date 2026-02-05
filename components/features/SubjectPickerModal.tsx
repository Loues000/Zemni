"use client";

import { useEffect, useMemo, useState } from "react";
import type { Subject } from "@/types";
import { IconX } from "@/components/ui";

type SubjectPickerModalProps = {
  isOpen: boolean;
  subjects: Subject[];
  selectedSubjectId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

/**
 * Modal picker for selecting a Notion subject.
 */
export function SubjectPickerModal({
  isOpen,
  subjects,
  selectedSubjectId,
  onSelect,
  onClose
}: SubjectPickerModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    /**
     * Close modal on Escape key.
     */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => s.title.toLowerCase().includes(q));
  }, [query, subjects]);

  if (!isOpen) return null;

  return (
    <div className="subject-picker-overlay" role="dialog" aria-modal="true" aria-label="Select subject">
      <button type="button" className="subject-picker-backdrop" onClick={onClose} aria-label="Close subject picker" />
      <div className="subject-picker">
        <div className="subject-picker-header">
          <div className="subject-picker-title">Select subject</div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        <div className="subject-picker-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            autoFocus
          />
        </div>

        <div className="subject-picker-list" role="list">
          {filtered.length === 0 ? (
            <div className="subject-picker-empty">No subjects found.</div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                className={"subject-picker-item" + (s.id === selectedSubjectId ? " active" : "")}
                onClick={() => onSelect(s.id)}
                aria-pressed={s.id === selectedSubjectId}
              >
                <span className="subject-picker-item-title">{s.title}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
