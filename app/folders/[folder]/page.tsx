"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { decodeFolderSlug, UNSORTED_FOLDER_SLUG } from "@/lib/folder-slug";
import { DEFAULT_FOLDER_LABEL } from "@/lib/history-folders";
import type { OutputEntry } from "@/types";

interface FolderPageProps {
  params: { folder: string };
}

interface DocumentOutputOverview {
  latestSummary: OutputEntry | null;
  flashcardCount: number;
  quizCount: number;
  summarySnippet: string;
}

function getOutputOverview(outputs: Record<string, OutputEntry>): DocumentOutputOverview {
  const entries = Object.values(outputs);
  
  // Find latest summary by updatedAt
  const latestSummary = entries
    .filter((e) => e.summary && e.summary.trim().length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
  
  // Count flashcards across all outputs
  const flashcardCount = entries.reduce(
    (sum, e) => sum + (e.flashcards?.length || 0),
    0
  );
  
  // Count quiz questions across all outputs
  const quizCount = entries.reduce(
    (sum, e) => sum + (e.quiz?.length || 0),
    0
  );
  
  // Create summary snippet by stripping markdown
  let summarySnippet = "";
  if (latestSummary?.summary) {
    // Simple regex to strip markdown and get plain text
    summarySnippet = latestSummary.summary
      .replace(/#{1,6}\s/g, "") // Remove headers
      .replace(/\*\*|\*|__|_/g, "") // Remove bold/italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Replace links with text
      .replace(/`{3}[\s\S]*?`{3}/g, "") // Remove code blocks
      .replace(/`([^`]+)`/g, "$1") // Remove inline code
      .replace(/\n+/g, " ") // Replace newlines with spaces
      .trim();
    
    // Limit to 200 characters
    if (summarySnippet.length > 200) {
      summarySnippet = summarySnippet.slice(0, 197) + "...";
    }
  }
  
  return {
    latestSummary,
    flashcardCount,
    quizCount,
    summarySnippet,
  };
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function FolderPage({ params }: FolderPageProps) {
  const router = useRouter();
  const folderSlug = params.folder ?? "";

  // Decode folder name from slug
  const folderName = useMemo(() => {
    if (!folderSlug) return null;
    if (folderSlug === UNSORTED_FOLDER_SLUG) return null;
    return decodeFolderSlug(folderSlug);
  }, [folderSlug]);

  const displayName = folderName || DEFAULT_FOLDER_LABEL;

  // Query documents by folder
  const documents = useQuery(
    api.documents.listByFolder,
    folderSlug ? { folder: folderName, limit: 200 } : "skip"
  );

  // Calculate stats
  const stats = useMemo(() => {
    if (!documents) {
      return {
        entries: 0,
        summaries: 0,
        flashcards: 0,
        quizzes: 0,
        lastUpdated: null as number | null,
      };
    }

    let summaries = 0;
    let flashcards = 0;
    let quizzes = 0;
    let lastUpdated: number | null = null;

    documents.forEach((doc) => {
      const outputs = (doc.outputs as Record<string, OutputEntry>) || {};
      const hasSummary = Object.values(outputs).some(
        (e) => e.summary && e.summary.trim().length > 0
      );
      if (hasSummary) summaries++;

      flashcards += Object.values(outputs).reduce(
        (sum, e) => sum + (e.flashcards?.length || 0),
        0
      );

      quizzes += Object.values(outputs).reduce(
        (sum, e) => sum + (e.quiz?.length || 0),
        0
      );

      if (doc.updatedAt > (lastUpdated || 0)) {
        lastUpdated = doc.updatedAt;
      }
    });

    return {
      entries: documents.length,
      summaries,
      flashcards,
      quizzes,
      lastUpdated,
    };
  }, [documents]);

  const handleOpenInChat = (documentId: string) => {
    router.push(`/?document=${documentId}`);
  };

  const handleBackToChat = () => {
    router.push("/");
  };

  if (!documents) {
    return (
      <div className="folder-page">
        <div className="folder-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="folder-page">
      <header className="folder-header">
        <div className="folder-header-content">
          <h1 className="folder-title">{displayName}</h1>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleBackToChat}
          >
            Back to Chat
          </button>
        </div>
      </header>

      <div className="folder-stats">
        <div className="folder-stat">
          <span className="folder-stat-value">{stats.entries}</span>
          <span className="folder-stat-label">Entries</span>
        </div>
        <div className="folder-stat">
          <span className="folder-stat-value">{stats.summaries}</span>
          <span className="folder-stat-label">Summaries</span>
        </div>
        <div className="folder-stat">
          <span className="folder-stat-value">{stats.flashcards}</span>
          <span className="folder-stat-label">Flashcards</span>
        </div>
        <div className="folder-stat">
          <span className="folder-stat-value">{stats.quizzes}</span>
          <span className="folder-stat-label">Quizzes</span>
        </div>
        {stats.lastUpdated && (
          <div className="folder-stat">
            <span className="folder-stat-value">
              {formatDate(stats.lastUpdated)}
            </span>
            <span className="folder-stat-label">Last Updated</span>
          </div>
        )}
      </div>

      <div className="folder-card-grid">
        {documents.map((doc) => {
          const outputs = (doc.outputs as Record<string, OutputEntry>) || {};
          const overview = getOutputOverview(outputs);

          return (
            <div key={doc._id} className="folder-card">
              <div className="folder-card-header">
                <h3 className="folder-card-title">{doc.title}</h3>
                <span className="folder-card-filename">{doc.fileName}</span>
              </div>

              <div className="folder-card-meta">
                <span>Updated {formatDate(doc.updatedAt)}</span>
              </div>

              {overview.summarySnippet && (
                <p className="folder-card-snippet">{overview.summarySnippet}</p>
              )}

              <div className="folder-card-counts">
                {overview.latestSummary && (
                  <span className="folder-count">
                    <span className="folder-count-icon">📝</span>
                    Summary
                  </span>
                )}
                {overview.flashcardCount > 0 && (
                  <span className="folder-count">
                    <span className="folder-count-icon">🎴</span>
                    {overview.flashcardCount} flashcards
                  </span>
                )}
                {overview.quizCount > 0 && (
                  <span className="folder-count">
                    <span className="folder-count-icon">❓</span>
                    {overview.quizCount} quiz questions
                  </span>
                )}
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm folder-card-action"
                onClick={() => handleOpenInChat(doc._id)}
              >
                Open in chat
              </button>
            </div>
          );
        })}
      </div>

      {documents.length === 0 && (
        <div className="folder-empty">
          <p>No documents in this folder yet.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleBackToChat}
          >
            Go to Chat to add documents
          </button>
        </div>
      )}
    </div>
  );
}
