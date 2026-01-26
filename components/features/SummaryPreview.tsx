import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { IconEdit, IconCopy, IconCheck, IconClose } from "../ui/Icons";
import type { OutputEntry } from "@/types";
import { isStandaloneLatexMathLine } from "@/lib/latex-math";

const normalizeMathForPreview = (markdown: string): string => {
  if (!markdown) return markdown;
  const lines = markdown.split("\n");
  const out: string[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      out.push(line);
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    if (trimmed === "$$" || /^\$\$.*\$\$$/.test(trimmed)) {
      out.push(line);
      continue;
    }

    if (trimmed && isStandaloneLatexMathLine(trimmed)) {
      out.push("$$");
      out.push(trimmed);
      while (i + 1 < lines.length) {
        const next = lines[i + 1]?.trim() ?? "";
        if (!next || !isStandaloneLatexMathLine(next)) break;
        i += 1;
        out.push(next);
      }
      out.push("$$");
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
};

interface SummaryPreviewProps {
  isSplitView: boolean;
  selectedTabId: string | null;
  secondTabId: string | null;
  currentOutput: OutputEntry | undefined;
  secondOutput: OutputEntry | undefined;
  currentSummary: string;
  secondSummary: string;
  isEditing: boolean;
  isEditingSecond: boolean;
  editDraft: string;
  editDraftSecond: string;
  previewRef1: React.RefObject<HTMLDivElement>;
  previewRef2: React.RefObject<HTMLDivElement>;
  isScrolling: React.MutableRefObject<boolean>;
  copySuccess: boolean;
  copySuccessSecond: boolean;
  onEditStart: () => void;
  onEditSave: () => void;
  onEditStartSecond: () => void;
  onEditSaveSecond: () => void;
  onEditDraftChange: (value: string) => void;
  onEditDraftChangeSecond: (value: string) => void;
  onCopySummary: () => void;
  onCopySummarySecond: () => void;
  onSyncScroll: (source: 1 | 2) => void;
  onCloseSplit: () => void;
  extractedText: string;
}

export function SummaryPreview({
  isSplitView,
  selectedTabId,
  secondTabId,
  currentOutput,
  secondOutput,
  currentSummary,
  secondSummary,
  isEditing,
  isEditingSecond,
  editDraft,
  editDraftSecond,
  previewRef1,
  previewRef2,
  isScrolling,
  copySuccess,
  copySuccessSecond,
  onEditStart,
  onEditSave,
  onEditStartSecond,
  onEditSaveSecond,
  onEditDraftChange,
  onEditDraftChangeSecond,
  onCopySummary,
  onCopySummarySecond,
  onSyncScroll,
  onCloseSplit,
  extractedText
}: SummaryPreviewProps) {
  const handleSyncScroll = (source: 1 | 2) => {
    if (isScrolling.current) return;
    
    const sourceRef = source === 1 ? previewRef1 : previewRef2;
    const targetRef = source === 1 ? previewRef2 : previewRef1;
    
    if (!sourceRef.current || !targetRef.current) return;
    
    isScrolling.current = true;
    
    const sourceEl = sourceRef.current;
    const targetEl = targetRef.current;
    
    const scrollPercent = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight);
    const targetScrollTop = scrollPercent * (targetEl.scrollHeight - targetEl.clientHeight);
    
    targetEl.scrollTop = targetScrollTop;
    
    setTimeout(() => {
      isScrolling.current = false;
    }, 50);
  };

  return (
    <div className={`preview-container${isSplitView ? " split-view" : ""}`}>
      {isEditing ? (
        <div className="markdown-editor">
          <textarea
            value={editDraft}
            onChange={(e) => onEditDraftChange(e.target.value)}
            onBlur={onEditSave}
            autoFocus
          />
        </div>
      ) : isEditingSecond && isSplitView ? (
        <>
          <div 
            className="preview"
            ref={previewRef1}
          >
            {currentOutput && (
              <span className="preview-model-label">{currentOutput.label}</span>
            )}
            {currentSummary && (
              <div className="preview-toolbar">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onEditStart}
                  title="Edit"
                  aria-label="Edit Markdown"
                >
                  <IconEdit />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onCopySummary}
                  title="Copy"
                  aria-label="Copy summary"
                >
                  {copySuccess ? <IconCheck /> : <IconCopy />}
                </button>
              </div>
            )}
            {currentSummary ? (
              <div className="markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {normalizeMathForPreview(currentSummary)}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="preview-empty">
                {extractedText
                  ? "PDF loaded. Click Generate."
                  : "Upload a PDF to generate."}
              </div>
            )}
          </div>
          <div className="markdown-editor">
            {secondOutput && (
              <span className="preview-model-label">{secondOutput.label}</span>
            )}
            <textarea
              value={editDraftSecond}
              onChange={(e) => onEditDraftChangeSecond(e.target.value)}
              onBlur={onEditSaveSecond}
              autoFocus
            />
          </div>
        </>
      ) : (
        <>
          <div 
            className="preview"
            ref={previewRef1}
            onScroll={isSplitView ? () => handleSyncScroll(1) : undefined}
          >
            {isSplitView && currentOutput && (
              <span className="preview-model-label">{currentOutput.label}</span>
            )}
            {currentSummary && (
              <div className="preview-toolbar">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onEditStart}
                  title="Edit"
                  aria-label="Edit Markdown"
                >
                  <IconEdit />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onCopySummary}
                  title="Copy"
                  aria-label="Copy summary"
                >
                  {copySuccess ? <IconCheck /> : <IconCopy />}
                </button>
              </div>
            )}
            {currentSummary ? (
              <div className="markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {normalizeMathForPreview(currentSummary)}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="preview-empty">
                {extractedText
                  ? "PDF loaded. Click Generate."
                  : "Upload a PDF to generate."}
              </div>
            )}
          </div>
          
          {isSplitView && (
            <div 
              className="preview preview-second"
              ref={previewRef2}
              onScroll={() => handleSyncScroll(2)}
            >
              {secondOutput && (
                <span className="preview-model-label">{secondOutput.label}</span>
              )}
              <div className="preview-toolbar">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onEditStartSecond}
                  title="Edit"
                  aria-label="Edit Markdown"
                >
                  <IconEdit />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onCopySummarySecond}
                  title="Copy"
                  aria-label="Copy summary"
                >
                  {copySuccessSecond ? <IconCheck /> : <IconCopy />}
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-close"
                  onClick={onCloseSplit}
                  title="Close split view"
                  aria-label="Close split view"
                >
                  <IconClose />
                </button>
              </div>
              {secondSummary ? (
                <div className="markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {normalizeMathForPreview(secondSummary)}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="preview-empty">No summary</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
