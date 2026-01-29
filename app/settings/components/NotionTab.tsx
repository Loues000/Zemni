"use client";

import { useState, useEffect } from "react";

export function NotionTab() {
  const [notionToken, setNotionToken] = useState("");
  const [databaseId, setDatabaseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load existing values from localStorage (user's local settings)
  useEffect(() => {
    const savedToken = localStorage.getItem("notion_token");
    const savedDbId = localStorage.getItem("notion_database_id");
    if (savedToken) setNotionToken(savedToken);
    if (savedDbId) setDatabaseId(savedDbId);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      // Save to localStorage (client-side only)
      // In production, you might want to save these to Convex user preferences
      localStorage.setItem("notion_token", notionToken);
      localStorage.setItem("notion_database_id", databaseId);

      // Test the connection
      if (notionToken && databaseId) {
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
      } else {
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

  const handleClear = () => {
    if (confirm("Are you sure you want to clear your Notion configuration?")) {
      setNotionToken("");
      setDatabaseId("");
      localStorage.removeItem("notion_token");
      localStorage.removeItem("notion_database_id");
      setMessage({ type: "success", text: "Configuration cleared." });
    }
  };

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>Notion Integration</h2>
        <p>Configure your Notion database for exporting summaries</p>
      </div>

      <div className="settings-card">
        <div className="field">
          <label className="field-label" htmlFor="notion-token">
            Notion API Token
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
            Get your token from{" "}
            <a
              href="https://www.notion.so/my-integrations"
              target="_blank"
              rel="noopener noreferrer"
              className="settings-link"
            >
              Notion Integrations
            </a>
            . Make sure to grant access to your database.
          </p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="notion-database-id">
            Subjects Database ID
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
            The database ID can be found in your Notion database URL. It's the long string of characters
            after the last slash and before any query parameters.
          </p>
        </div>

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
          <label className="field-label">How to Set Up Notion Integration</label>
          <ol className="settings-instructions">
            <li>
              Go to{" "}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="settings-link"
              >
                Notion Integrations
              </a>{" "}
              and create a new integration
            </li>
            <li>Copy the "Internal Integration Token" and paste it above</li>
            <li>
              Create or open your subjects database in Notion and click "..." → "Add connections" →
              Select your integration
            </li>
            <li>
              Copy the database ID from the URL (the long string after the last "/" and before "?")
            </li>
            <li>Paste the database ID above and click "Save Configuration"</li>
          </ol>
        </div>
      </div>
    </section>
  );
}
