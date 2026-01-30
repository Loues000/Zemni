"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";

/**
 * AccountTab displays the current user's account information from Clerk and Convex.
 * Assumes it's rendered within a ClerkProvider and that the user is signed in.
 */
export function AccountTab() {
  const { user, isLoaded } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateLanguage = useMutation(api.users.updatePreferredLanguage);
  const updateName = useMutation(api.users.updatePreferredName);
  const updateGuidelines = useMutation(api.users.updateCustomGuidelines);
  const clearGuidelines = useMutation(api.users.clearCustomGuidelines);

  const [language, setLanguage] = useState<string>("en");
  const [preferredName, setPreferredName] = useState<string>("");
  const [customGuidelines, setCustomGuidelines] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
        <p>Manage your profile and usage preferences</p>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">Profile Details</h3>
        <div className="settings-card-split">
          <div className="field">
            <label className="field-label">Preferred Name</label>
            <div className="field-value">
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
          </div>

          <div className="field">
            <label className="field-label">Email Address</label>
            <div className="field-value field-value-muted">{user.emailAddresses[0]?.emailAddress}</div>
          </div>
        </div>

        <div className="settings-divider" />

        <div className="field">
          <label className="field-label" htmlFor="language-select">
            Language Preference
          </label>
          <select
            id="language-select"
            className="field-input"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={saving}
          >
            <option value="en">English</option>
            <option value="de">German</option>
          </select>
          <p className="field-hint">
            This determines which guideline files are used for your generations. Changing this will affect all future generations.
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
        <h2>Danger Zone</h2>
        <p>Irreversible account actions</p>
      </div>
      <div className="settings-card settings-card-danger">
        <div className="field">
          <button type="button" className="btn btn-danger btn-small">
            Delete Account
          </button>
          <p className="field-hint field-hint-error">
            Permanently delete your account and all data.
          </p>
        </div>
      </div>
    </section>
  );
}
