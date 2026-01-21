import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { IconEdit, IconCopy, IconCheck, IconClose } from "../ui/Icons";
import type { OutputEntry } from "@/types";

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
                  title="Bearbeiten"
                  aria-label="Markdown bearbeiten"
                >
                  <IconEdit />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onCopySummary}
                  title="Kopieren"
                  aria-label="Zusammenfassung kopieren"
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
                  {currentSummary}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="preview-empty">
                {extractedText
                  ? "PDF geladen. Auf Generieren klicken."
                  : "PDF hochladen, dann Generieren."}
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
                  title="Bearbeiten"
                  aria-label="Markdown bearbeiten"
                >
                  <IconEdit />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onCopySummary}
                  title="Kopieren"
                  aria-label="Zusammenfassung kopieren"
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
                  {currentSummary}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="preview-empty">
                {extractedText
                  ? "PDF geladen. Auf Generieren klicken."
                  : "PDF hochladen, dann Generieren."}
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
                  title="Bearbeiten"
                  aria-label="Markdown bearbeiten"
                >
                  <IconEdit />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onCopySummarySecond}
                  title="Kopieren"
                  aria-label="Zusammenfassung kopieren"
                >
                  {copySuccessSecond ? <IconCheck /> : <IconCopy />}
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-close"
                  onClick={onCloseSplit}
                  title="Split schliessen"
                  aria-label="Split-View schliessen"
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
                    {secondSummary}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="preview-empty">Keine Zusammenfassung</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
