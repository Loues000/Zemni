"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { decryptKey } from "@/lib/encryption";

export function NotionTab() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateNotionConfig = useMutation(api.users.updateNotionConfig);
  const clearNotionConfig = useMutation(api.users.clearNotionConfig);
  
  const [notionToken, setNotionToken] = useState("");
  const [databaseId, setDatabaseId] = useState("");
  const [exportMethod, setExportMethod] = useState<"database" | "page">("database");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load existing values from Convex
  useEffect(() => {
    if (currentUser) {
      // Decrypt token if present
      if (currentUser.notionToken) {
        try {
          const decrypted = decryptKey(currentUser.notionToken);
          setNotionToken(decrypted);
        } catch (error) {
          console.error("Failed to decrypt Notion token:", error);
          setNotionToken("");
        }
      } else {
        setNotionToken("");
      }
      setDatabaseId(currentUser.notionDatabaseId || "");
      setExportMethod(currentUser.notionExportMethod || "database");
    }
  }, [currentUser]);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      // Save to Convex
      if (notionToken) {
        await updateNotionConfig({
          token: notionToken,
          databaseId: exportMethod === "database" ? databaseId : undefined,
          exportMethod: exportMethod,
        });

        // Test the connection
        if (exportMethod === "database" && databaseId) {
          const url = new URL("/api/notion/subjects", window.location.origin);
          url.searchParams.set("databaseId", databaseId);
          const testRes = await fetch(url.toString(), {
            headers: {
              "x-notion-token": notionToken,
            },
          });
          if (testRes.ok) {
            const data = await testRes.json();
            if (data.subjects && Array.isArray(data.subjects)) {
              setMessage({ type: "success", text: `Notion configuration saved and verified! Found ${data.subjects.length} subject(s).` });
            } else {
              setMessage({ type: "success", text: "Notion configuration saved and verified!" });
            }
          } else {
            setMessage({ type: "error", text: "Configuration saved but connection test failed. Please check your credentials." });
          }
        } else if (exportMethod === "page") {
          setMessage({ type: "success", text: "Notion configuration saved! You can now export directly to pages." });
        } else {
          setMessage({ type: "success", text: "Configuration saved. Token only - you can export to new pages." });
        }
      } else {
        // Clear configuration
        await clearNotionConfig({});
        setMessage({ type: "success", text: "Configuration cleared." });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save configuration",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (confirm("Are you sure you want to clear your Notion configuration?")) {
      setLoading(true);
      setMessage(null);
      try {
        await clearNotionConfig({});
        setNotionToken("");
        setDatabaseId("");
        setExportMethod("database");
        setMessage({ type: "success", text: "Configuration cleared." });
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to clear configuration",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>Notion Integration</h2>
        <p>Connect your Notion workspace to export summaries</p>
      </div>

      <div className="settings-card">
        <div className="field">
          <label className="field-label" htmlFor="notion-token">
            Notion API Token <span style={{ color: "var(--error-text)" }}>*</span>
          </label>
          <input
            id="notion-token"
            type="password"
            className="field-input"
            placeholder="secret_..."
            value={notionToken}
            onChange={(e) => setNotionToken(e.target.value)}
            disabled={loading}
          />
          <p className="field-hint">
            Create an integration at{" "}
            <a
              href="https://www.notion.so/my-integrations"
              target="_blank"
              rel="noopener noreferrer"
              className="settings-link"
            >
              notion.so/my-integrations
            </a>
            {" "}and copy the token.
          </p>
        </div>

        <div className="settings-divider" />

        <div className="field">
          <label className="field-label">Export Method</label>
          <div className="settings-radio-group">
            <label className="settings-radio">
              <input
                type="radio"
                name="export-method"
                value="database"
                checked={exportMethod === "database"}
                onChange={(e) => setExportMethod(e.target.value as "database")}
                disabled={loading}
              />
              <span>Subjects Database (Organized)</span>
            </label>
            <label className="settings-radio">
              <input
                type="radio"
                name="export-method"
                value="page"
                checked={exportMethod === "page"}
                onChange={(e) => setExportMethod(e.target.value as "page")}
                disabled={loading}
              />
              <span>Direct Page Export (Simple)</span>
            </label>
          </div>
          <p className="field-hint">
            {exportMethod === "database"
              ? "Organize exports by subject in a database."
              : "Export directly to new pages without a database."}
          </p>
        </div>

        {exportMethod === "database" && (
          <div className="field">
            <label className="field-label" htmlFor="notion-database-id">
              Subjects Database ID <span style={{ color: "var(--error-text)" }}>*</span>
            </label>
            <input
              id="notion-database-id"
              type="text"
              className="field-input"
              placeholder="a1b2c3d4e5f6g7h8i9j0k1l2m3"
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
              disabled={loading}
            />
            <p className="field-hint">
              Find the database ID in the URL: the long string after the last "/" and before "?".
            </p>
          </div>
        )}

        {message && (
          <div className={`settings-notice ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="settings-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Configuration"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClear}
            disabled={loading}
          >
            Clear
          </button>
        </div>

        <div className="settings-divider" />

        <div className="field">
          <label className="field-label">Setup Instructions</label>
          <ol className="settings-instructions">
            <li>Create an integration at{" "}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="settings-link"
              >
                notion.so/my-integrations
              </a>
            </li>
            <li>Copy the integration token and paste it above</li>
            {exportMethod === "database" && (
              <>
                <li>Open your database in Notion → "..." → "Add connections" → Select your integration</li>
                <li>Copy the database ID from the URL and paste it above</li>
              </>
            )}
            <li>Click "Save Configuration"</li>
          </ol>
        </div>
      </div>
    </section>
  );
}
