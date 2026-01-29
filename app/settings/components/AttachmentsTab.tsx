"use client";

export function AttachmentsTab() {
  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>Attachments</h2>
        <p>Manage file upload settings and storage</p>
      </div>

      <div className="settings-card">
        <div className="field">
          <label className="field-label">Supported File Types</label>
          <div className="field-value">PDF, Markdown (.md), Text (.txt)</div>
        </div>

        <div className="field">
          <label className="field-label">Maximum File Size</label>
          <div className="field-value">50 MB</div>
        </div>

        <div className="field">
          <label className="field-label">Storage</label>
          <p className="field-hint">
            Files are processed client-side when possible. Large files may be processed server-side.
          </p>
        </div>
      </div>
    </section>
  );
}
