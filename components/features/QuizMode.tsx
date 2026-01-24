"use client";

import { useEffect, useMemo, useState } from "react";
import type { OutputEntry, QuizQuestion, Status } from "@/types";
import { downloadTextFile } from "@/lib/download";
import { quizToMarkdown } from "@/lib/exporters";
import { ExportMenu } from "@/components/ui";

const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable ||
    Boolean(el.closest?.("[contenteditable='true']"))
  );
};

type QuizModeProps = {
  extractedText: string;
  fileName: string;
  output?: OutputEntry;
  status: Status;
  onReveal: () => void;
  onNext: () => void | Promise<void>;
  onSelectOption: (index: number) => void;
};

const baseNameFor = (fileName: string): string => {
  const trimmed = (fileName || "").trim();
  if (!trimmed) return "document";
  return trimmed.replace(/\.[^.]+$/, "");
};

export function QuizMode({ extractedText, fileName, output, status, onReveal, onNext, onSelectOption }: QuizModeProps) {
  const quiz = output?.quiz ?? [];
  const state = output?.quizState;

  const cursor = state?.questionCursor ?? 0;
  const currentQuestion: QuizQuestion | undefined = quiz[cursor];
  const reveal = Boolean(state?.revealAnswer);
  const selectedIndex = state?.selectedOptionIndex;

  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    setFocusIndex(0);
  }, [cursor, output?.id]);

  const optionCount = currentQuestion?.options.length ?? 0;
  const isBusy = status === "summarizing" || status === "parsing";

  useEffect(() => {
    if (!currentQuestion) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const key = e.key;
      if (key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((prev) => (optionCount ? (prev - 1 + optionCount) % optionCount : 0));
        return;
      }
      if (key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((prev) => (optionCount ? (prev + 1) % optionCount : 0));
        return;
      }

      const number = Number(key);
      if (!Number.isNaN(number) && number >= 1 && number <= optionCount) {
        e.preventDefault();
        onSelectOption(number - 1);
        return;
      }

      const upper = key.toUpperCase();
      const idxFromLetter = upper.charCodeAt(0) - 65;
      if (idxFromLetter >= 0 && idxFromLetter < optionCount) {
        e.preventDefault();
        onSelectOption(idxFromLetter);
        return;
      }

      if (key === "Enter" || key === " ") {
        e.preventDefault();
        onSelectOption(focusIndex);
        return;
      }

      if (upper === "R") {
        e.preventDefault();
        onReveal();
        return;
      }

      if (key === "ArrowRight" || upper === "N") {
        e.preventDefault();
        if (!isBusy) void onNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentQuestion, focusIndex, isBusy, onNext, onReveal, onSelectOption, optionCount]);

  const selectedIsCorrect = useMemo(() => {
    if (!currentQuestion) return null;
    if (selectedIndex === undefined || selectedIndex === null) return null;
    return selectedIndex === currentQuestion.correctIndex;
  }, [currentQuestion, selectedIndex]);

  if (!extractedText) {
    return <div className="mode-empty">Upload a PDF/MD file, then click Generate.</div>;
  }

  if (!output) {
    return <div className="mode-empty">No quiz yet. Click Generate.</div>;
  }

  if (output.isGenerating && !currentQuestion) {
    return <div className="mode-empty">Generating questions...</div>;
  }

  if (!currentQuestion) {
    return <div className="mode-empty">No questions available.</div>;
  }

  const handleExportMarkdown = () => {
    const { fileName: exportName, content } = quizToMarkdown(quiz, fileName);
    downloadTextFile(exportName, content, "text/markdown;charset=utf-8");
  };

  const handleExportJson = () => {
    const base = baseNameFor(fileName);
    downloadTextFile(`${base}-quiz.json`, JSON.stringify({ questions: quiz }, null, 2) + "\n", "application/json;charset=utf-8");
  };

  return (
    <div className="quiz-view">
      <div className="quiz-meta">
        <span>Question {cursor + 1} / {Math.max(1, quiz.length)}</span>
        <div className="quiz-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onReveal}>
            {reveal ? "Hide" : "Reveal"} (R)
          </button>
          <ExportMenu
            disabled={!quiz.length}
            options={[
              { id: "md", label: "Markdown (.md)", onSelect: handleExportMarkdown },
              { id: "json", label: "JSON (.json)", onSelect: handleExportJson }
            ]}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void onNext()}
            disabled={isBusy}
          >
            Next (→)
          </button>
        </div>
      </div>

      <div className="quiz-question">{currentQuestion.question}</div>

      <div className="quiz-options" role="list">
        {currentQuestion.options.map((opt, idx) => {
          const isSelected = selectedIndex === idx;
          const isCorrect = idx === currentQuestion.correctIndex;
          const selectedClass = isSelected ? (isCorrect ? " selected correct" : " selected wrong") : "";
          const revealClass = reveal && isCorrect ? " correct" : "";
          const focusClass = idx === focusIndex ? " focused" : "";
          return (
            <button
              key={idx}
              type="button"
              className={`quiz-option${selectedClass}${revealClass}${focusClass}`}
              onClick={() => onSelectOption(idx)}
              aria-pressed={isSelected}
            >
              <span className="quiz-option-letter">{String.fromCharCode(65 + idx)}.</span>
              <span className="quiz-option-text">{opt}</span>
            </button>
          );
        })}
      </div>

      {(reveal || selectedIndex !== undefined) && (
        <div className="quiz-answer">
          {selectedIsCorrect === true ? (
            <div className="quiz-feedback ok">Correct.</div>
          ) : selectedIsCorrect === false ? (
            <div className="quiz-feedback bad">Wrong.</div>
          ) : null}
          {reveal && currentQuestion.explanation ? <div className="quiz-explanation">{currentQuestion.explanation}</div> : null}
          {reveal ? (
            <details className="quiz-source-details">
              <summary>Source</summary>
              <div className="quiz-source-snippet">{currentQuestion.sourceSnippet}</div>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}
