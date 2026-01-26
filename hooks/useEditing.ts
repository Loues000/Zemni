import { useState } from "react";

export interface UseEditingReturn {
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  isEditingSecond: boolean;
  setIsEditingSecond: (editing: boolean) => void;
  editDraft: string;
  setEditDraft: (draft: string) => void;
  editDraftSecond: string;
  setEditDraftSecond: (draft: string) => void;
}

/**
 * Manages edit mode state for summary editing
 */
export function useEditing(): UseEditingReturn {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSecond, setIsEditingSecond] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editDraftSecond, setEditDraftSecond] = useState("");

  return {
    isEditing,
    setIsEditing,
    isEditingSecond,
    setIsEditingSecond,
    editDraft,
    setEditDraft,
    editDraftSecond,
    setEditDraftSecond
  };
}
