"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClerkSignedIn, ClerkSignedOut, ClerkSignInButton } from "@/components/auth/ClerkWrapper";

// Prevent static generation - requires authentication
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const documents = useQuery(api.documents.list, { limit: 100 });
  const searchResults = useQuery(
    api.documents.search,
    searchQuery ? { query: searchQuery, limit: 50 } : "skip"
  );
  const deleteDoc = useMutation(api.documents.remove);

  const displayDocs = searchQuery && searchResults ? searchResults : documents?.documents || [];

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await deleteDoc({ documentId: docId as any });
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("Failed to delete document");
    }
  };

  const handleOpen = (docId: string) => {
    router.push(`/?document=${docId}`);
  };

  return (
    <>
      <ClerkSignedIn>
        <div className="dashboard-page">
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">Dashboard</h1>
              <p className="dashboard-subtitle">Manage your documents and view your activity</p>
            </div>
            <Link href="/" className="btn btn-secondary">
              ← Back to Chat
            </Link>
          </div>

          <div className="dashboard-controls">
            <input
              type="text"
              className="field-input"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: "400px" }}
            />
          </div>

          <div className="dashboard-stats">
            <div className="dashboard-stat">
              <div className="dashboard-stat-label">Total Documents</div>
              <div className="dashboard-stat-value">{documents?.documents.length || 0}</div>
            </div>
          </div>

          <div className="dashboard-documents">
            {displayDocs.length === 0 ? (
              <div className="dashboard-empty">
                <p>No documents yet. Start by creating a summary!</p>
                <Link href="/" className="btn btn-primary">
                  Create Summary
                </Link>
              </div>
            ) : (
              <div className="dashboard-list">
                {displayDocs.map((doc: any) => (
                  <div key={doc._id} className="dashboard-card">
                    <div className="dashboard-card-content">
                      <h3 className="dashboard-card-title">{doc.title}</h3>
                      <p className="dashboard-card-meta">
                        {doc.fileName} • {new Date(doc.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="dashboard-card-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={() => handleOpen(doc._id)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={() => handleDelete(doc._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ClerkSignedIn>
      <ClerkSignedOut>
        <div className="dashboard-page">
          <div className="dashboard-empty">
            <h2>Sign In Required</h2>
            <p>Please sign in to access your dashboard.</p>
            <ClerkSignInButton mode="modal">
              <button type="button" className="btn btn-primary">
                Sign In
              </button>
            </ClerkSignInButton>
          </div>
        </div>
      </ClerkSignedOut>
    </>
  );
}
