"use client";

import { useState } from "react";

/**
 * Renders a contact form for users to send a subject and message, handling submission to `/api/contact` and showing loading, success, and error states.
 *
 * The component manages form state, disables the submit button while sending or after success, clears the form on successful send, and shows a brief confirmation message. It also exposes resource links for keyboard shortcuts, bug reports, and feature requests.
 *
 * @returns A JSX element containing the contact form and related resources.
 */
export function ContactTab() {
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setSubmitted(true);
      setFormData({ subject: "", message: "" });
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>Contact Us</h2>
        <p>Get help, report bugs, or share feedback</p>
      </div>

      <div className="settings-card">
        <form onSubmit={handleSubmit} className="settings-contact-form">
          <div className="field">
            <label className="field-label" htmlFor="contact-subject">
              Subject
            </label>
            <input
              id="contact-subject"
              type="text"
              className="field-input"
              value={formData.subject}
              onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="What can we help you with?"
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="contact-message">
              Message
            </label>
            <textarea
              id="contact-message"
              className="field-input settings-textarea"
              rows={8}
              value={formData.message}
              onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
              placeholder="Describe your issue or feedback..."
              required
            />
          </div>

          {error && (
            <div className="settings-notice error" style={{ marginBottom: "12px" }}>
              {error}
            </div>
          )}

          <div className="settings-row">
            <button type="submit" className="btn btn-primary" disabled={loading || submitted}>
              {loading ? "Sending..." : submitted ? "Submitted!" : "Send Message"}
            </button>
          </div>

          {submitted && (
            <p className="field-hint" style={{ color: "var(--success)" }}>
              Thank you for your message! We'll get back to you soon.
            </p>
          )}
        </form>

        <div className="settings-divider" />

        <div className="field">
          <label className="field-label">Resources</label>
          <div className="settings-resources">
            <a href="/docs/keyboard-shortcuts.md" target="_blank" className="settings-resource-link">
              Keyboard Shortcuts
            </a>
            <a href="https://github.com/your-repo/issues" target="_blank" className="settings-resource-link">
              Report a Bug
            </a>
            <a href="https://github.com/your-repo/discussions" target="_blank" className="settings-resource-link">
              Feature Requests
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}