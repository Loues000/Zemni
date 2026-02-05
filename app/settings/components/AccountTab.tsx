"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

/**
 * AccountTab displays the current user's account information from Clerk and Convex.
 * Assumes it's rendered within a ClerkProvider and that the user is signed in.
 */
export function AccountTab() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateLanguage = useMutation(api.users.updatePreferredLanguage);
  const updateName = useMutation(api.users.updatePreferredName);
  const updateGuidelines = useMutation(api.users.updateCustomGuidelines);
  const clearGuidelines = useMutation(api.users.clearCustomGuidelines);
  const anonymizeAccount = useMutation(api.users.anonymizeAccount);

  const [language, setLanguage] = useState<string>("en");
  const [preferredName, setPreferredName] = useState<string>("");
  const [customGuidelines, setCustomGuidelines] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load user preferences
  useEffect(() => {
    if (currentUser && user) {
      setLanguage(currentUser.preferredLanguage || "en");
      setCustomGuidelines(currentUser.customGuidelines || "");
      setPreferredName(currentUser.preferredName || user.fullName || "");
    }
  }, [currentUser, user]);

  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage);
    setSaving(true);
    setMessage(null);
    try {
      await updateLanguage({ language: newLanguage });
      setMessage({ type: "success", text: "Language preference saved." });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save language preference." });
      setLanguage(currentUser?.preferredLanguage || "en");
    } finally {
      setSaving(false);
    }
  };

  const handleNameChange = async (newName: string) => {
    setPreferredName(newName);
    setSaving(true);
    setMessage(null);
    try {
      await updateName({ name: newName });
      setMessage({ type: "success", text: "Name saved." });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save name." });
      setPreferredName(currentUser?.preferredName || user?.fullName || "");
    } finally {
      setSaving(false);
    }
  };

  const handleGuidelinesChange = (value: string) => {
    setCustomGuidelines(value);
  };

  const handleSaveGuidelines = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateGuidelines({ guidelines: customGuidelines });
      setMessage({ type: "success", text: "Custom guidelines saved." });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save guidelines." });
    } finally {
      setSaving(false);
    }
  };

  const handleRevertGuidelines = async () => {
    if (!confirm("Are you sure you want to revert to default guidelines? Your custom guidelines will be lost.")) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await clearGuidelines({});
      setCustomGuidelines("");
      setMessage({ type: "success", text: "Reverted to default guidelines." });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to revert guidelines." });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await anonymizeAccount({});
      setMessage({ type: "success", text: "Account anonymized successfully. Redirecting..." });
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to anonymize account. Please try again." });
      setShowDeleteConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded || !user) {
    return (
      <section className="settings-section">
        <div className="settings-section-header">
          <h2>Account</h2>
          <p>Loading account information...</p>
        </div>
      </section>
    );
  }

  const subscriptionTier = currentUser?.subscriptionTier || "free";
  const tierLabels: Record<string, string> = {
    free: "Free",
    basic: "Basic",
    plus: "Plus",
    pro: "Pro",
  };

  const hasCustomGuidelines = currentUser?.customGuidelines && currentUser.customGuidelines.trim().length > 0;

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>Account Settings</h2>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">Profile Details</h3>
        <div className="settings-card-split">
          <div className="field">
            <label className="field-label">Preferred Name</label>
            <input
              type="text"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              onBlur={() => handleNameChange(preferredName)}
              placeholder="How should we call you?"
              className="input-text field-value-input"
              disabled={saving}
            />
          </div>

          <div className="field">
            <label className="field-label">Email Address</label>
            <div className="field-value field-value-muted">{user.emailAddresses[0]?.emailAddress}</div>
          </div>
        </div>

        <div className="settings-divider" />

        <div className="field">
          <label className="field-label" htmlFor="language-select">
            Output Language
          </label>
          <select
            id="language-select"
            className="field-input"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={saving}
          >
            <option value="en">English</option>
            <option value="de">German (Deutsch)</option>
            <option value="es">Spanish (Español)</option>
            <option value="fr">French (Français)</option>
            <option value="it">Italian (Italiano)</option>
          </select>
          <p className="field-hint">
            The language of your generated summaries, flashcards, and quizzes. Input language doesn't matter - upload content in any language and get output in your preferred language.
          </p>
        </div>
      </div>

      <div className="settings-section-header settings-section-header-spaced">
        <h2>User Guidelines</h2>
        <p>Standard instructions applied to all your generations</p>
      </div>

      <div className="settings-card">
        <div className="field">
          <div className="settings-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label className="field-label">System-wide Guidelines</label>
            {hasCustomGuidelines && (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={handleRevertGuidelines}
                disabled={saving}
              >
                Revert to Default
              </button>
            )}
          </div>
          <textarea
            placeholder="Add instructions that should always be followed (e.g., 'Always explain formulas in detail', 'Use a professional tone')..."
            className="settings-textarea"
            value={customGuidelines}
            onChange={(e) => handleGuidelinesChange(e.target.value)}
            disabled={saving}
          />
          <p className="field-hint field-hint-spaced">
            {hasCustomGuidelines
              ? "Custom guidelines are active. These will be appended to the default guidelines for all your generations."
              : "These guidelines are automatically appended to every prompt sent to the model. Leave empty to use default guidelines only."}
          </p>
          {message && (
            <div className={`settings-notice ${message.type}`} style={{ marginTop: "8px" }}>
              {message.text}
            </div>
          )}
          <div className="settings-row" style={{ marginTop: "12px" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveGuidelines}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Guidelines"}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section-header settings-section-header-spaced">
        <h2>Account Management</h2>
        <p>Data privacy and account options</p>
      </div>
      <div className="settings-card settings-card-danger">
        <div className="field">
          <h3 className="settings-card-title" style={{ marginBottom: "8px", color: "var(--error-text)" }}>Danger Zone</h3>
          <p className="field-hint" style={{ marginBottom: "12px" }}>
            Delete your account and anonymize your data. This action cannot be undone.
            Your personal information (email, name, guidelines) will be permanently removed.
          </p>
          {!showDeleteConfirm ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving}
            >
              Delete Account
            </button>
          ) : (
            <div className="settings-delete-confirm">
              <p className="field-hint" style={{ marginBottom: "12px", color: "var(--error-text)" }}>
                Are you sure? This will anonymize your account and cannot be undone.
              </p>
              <div className="settings-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteAccount}
                  disabled={saving}
                >
                  {saving ? "Processing..." : "Yes, Delete My Account"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
