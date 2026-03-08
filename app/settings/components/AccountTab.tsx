"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

type Notice = { type: "success" | "error"; text: string } | null;

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
  const [profilePending, setProfilePending] = useState<"name" | "language" | null>(null);
  const [profileNotice, setProfileNotice] = useState<Record<"name" | "language", Notice>>({
    name: null,
    language: null,
  });
  const [guidelinesPending, setGuidelinesPending] = useState<"save" | "revert" | null>(null);
  const [guidelinesNotice, setGuidelinesNotice] = useState<Notice>(null);
  const [accountPending, setAccountPending] = useState<"delete" | null>(null);
  const [accountNotice, setAccountNotice] = useState<Notice>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (currentUser && user) {
      setLanguage(currentUser.preferredLanguage || "en");
      setCustomGuidelines(currentUser.customGuidelines || "");
      setPreferredName(currentUser.preferredName || user.fullName || "");
    }
  }, [currentUser, user]);

  /**
   * Persist a new preferred output language.
   */
  const handleLanguageChange = async (newLanguage: string) => {
    const previousLanguage = currentUser?.preferredLanguage || "en";
    setLanguage(newLanguage);
    setProfilePending("language");
    setProfileNotice((prev) => ({
      ...prev,
      language: { type: "success", text: "Saving language..." },
    }));

    try {
      await updateLanguage({ language: newLanguage });
      setProfileNotice((prev) => ({
        ...prev,
        language: { type: "success", text: "Language preference saved." },
      }));
    } catch {
      setLanguage(previousLanguage);
      setProfileNotice((prev) => ({
        ...prev,
        language: { type: "error", text: "Failed to save language preference." },
      }));
    } finally {
      setProfilePending(null);
    }
  };

  /**
   * Persist a new preferred name on blur when it changed.
   */
  const handleNameChange = async (newName: string) => {
    const fallbackName = currentUser?.preferredName || user?.fullName || "";
    const trimmedNewName = newName.trim();
    const trimmedFallbackName = fallbackName.trim();

    if (trimmedNewName === trimmedFallbackName) {
      setPreferredName(fallbackName);
      return;
    }

    setPreferredName(newName);
    setProfilePending("name");
    setProfileNotice((prev) => ({
      ...prev,
      name: { type: "success", text: "Saving name..." },
    }));

    try {
      await updateName({ name: newName });
      setProfileNotice((prev) => ({
        ...prev,
        name: { type: "success", text: "Name saved." },
      }));
    } catch {
      setPreferredName(fallbackName);
      setProfileNotice((prev) => ({
        ...prev,
        name: { type: "error", text: "Failed to save name." },
      }));
    } finally {
      setProfilePending(null);
    }
  };

  /**
   * Update the local guidelines draft.
   */
  const handleGuidelinesChange = (value: string) => {
    setCustomGuidelines(value);
  };

  /**
   * Save custom guidelines to the user profile.
   */
  const handleSaveGuidelines = async () => {
    setGuidelinesPending("save");
    setGuidelinesNotice(null);
    try {
      await updateGuidelines({ guidelines: customGuidelines });
      setGuidelinesNotice({ type: "success", text: "Custom guidelines saved." });
    } catch {
      setGuidelinesNotice({ type: "error", text: "Failed to save guidelines." });
    } finally {
      setGuidelinesPending(null);
    }
  };

  /**
   * Revert to default guidelines after confirmation.
   */
  const handleRevertGuidelines = async () => {
    if (!confirm("Are you sure you want to revert to default guidelines? Your custom guidelines will be lost.")) {
      return;
    }

    setGuidelinesPending("revert");
    setGuidelinesNotice({ type: "success", text: "Reverting to default guidelines..." });
    try {
      await clearGuidelines({});
      setCustomGuidelines("");
      setGuidelinesNotice({ type: "success", text: "Reverted to default guidelines." });
    } catch {
      setGuidelinesNotice({ type: "error", text: "Failed to revert guidelines." });
    } finally {
      setGuidelinesPending(null);
    }
  };

  /**
   * Anonymize the account and redirect after completion.
   */
  const handleDeleteAccount = async () => {
    setAccountPending("delete");
    setAccountNotice({ type: "success", text: "Anonymizing account..." });
    try {
      await anonymizeAccount({});
      setAccountNotice({ type: "success", text: "Account anonymized successfully. Redirecting..." });
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch {
      setAccountNotice({ type: "error", text: "Failed to anonymize account. Please try again." });
      setShowDeleteConfirm(false);
    } finally {
      setAccountPending(null);
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

  const profileBusy = profilePending !== null;
  const guidelinesBusy = guidelinesPending !== null;
  const accountBusy = accountPending !== null;
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
              onBlur={() => void handleNameChange(preferredName)}
              placeholder="How should we call you?"
              className="input-text field-value-input"
              disabled={profileBusy}
            />
            {profileNotice.name && (
              <div className={`settings-notice ${profileNotice.name.type}`} style={{ marginTop: "8px" }}>
                {profileNotice.name.text}
              </div>
            )}
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
            onChange={(e) => void handleLanguageChange(e.target.value)}
            disabled={profileBusy}
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
          {profileNotice.language && (
            <div className={`settings-notice ${profileNotice.language.type}`} style={{ marginTop: "8px" }}>
              {profileNotice.language.text}
            </div>
          )}
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
                onClick={() => void handleRevertGuidelines()}
                disabled={guidelinesBusy}
              >
                {guidelinesPending === "revert" ? "Reverting..." : "Revert to Default"}
              </button>
            )}
          </div>
          <textarea
            placeholder="Add instructions that should always be followed (e.g., 'Always explain formulas in detail', 'Use a professional tone')..."
            className="settings-textarea"
            value={customGuidelines}
            onChange={(e) => handleGuidelinesChange(e.target.value)}
            disabled={guidelinesBusy}
          />
          <p className="field-hint field-hint-spaced">
            {hasCustomGuidelines
              ? "Custom guidelines are active. These will be appended to the default guidelines for all your generations."
              : "These guidelines are automatically appended to every prompt sent to the model. Leave empty to use default guidelines only."}
          </p>
          {guidelinesNotice && (
            <div className={`settings-notice ${guidelinesNotice.type}`} style={{ marginTop: "8px" }}>
              {guidelinesNotice.text}
            </div>
          )}
          <div className="settings-row" style={{ marginTop: "12px" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSaveGuidelines()}
              disabled={guidelinesBusy}
            >
              {guidelinesPending === "save" ? "Saving..." : "Save Guidelines"}
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
          {accountNotice && (
            <div className={`settings-notice ${accountNotice.type}`} style={{ marginBottom: "12px" }}>
              {accountNotice.text}
            </div>
          )}
          {!showDeleteConfirm ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={accountBusy}
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
                  disabled={accountBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => void handleDeleteAccount()}
                  disabled={accountBusy}
                >
                  {accountBusy ? "Processing..." : "Yes, Delete My Account"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
