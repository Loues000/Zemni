"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";

/**
 * AccountTab displays the current user's account information from Clerk and Convex.
 * Assumes it's rendered within a ClerkProvider and that the user is signed in.
 */
export function AccountTab() {
  const { user, isLoaded } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);


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

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>Account Settings</h2>
        <p>Manage your profile and usage preferences</p>
      </div>

      <div className="settings-card">
        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>Profile Details</h3>
        <div className="settings-card-split">
          <div className="field">
            <label className="field-label">Preferred Name</label>
            <div className="field-value">
              <input
                type="text"
                defaultValue={user.fullName || ""}
                placeholder="How should we call you?"
                className="input-text"
                style={{ width: "100%", background: "transparent", border: "none", padding: "0", color: "inherit" }}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Email Address</label>
            <div className="field-value" style={{ opacity: 0.7 }}>{user.emailAddresses[0]?.emailAddress}</div>
          </div>
        </div>
      </div>

      <div className="settings-section-header" style={{ marginTop: "32px" }}>
        <h2>User Guidelines</h2>
        <p>Standard instructions applied to all your generations</p>
      </div>

      <div className="settings-card">
        <div className="field">
          <label className="field-label">System-wide Guidelines</label>
          <textarea
            placeholder="Add instructions that should always be followed (e.g., 'Always explain formulas in detail', 'Use a professional tone')..."
            className="input-text"
            style={{
              width: "100%",
              minHeight: "120px",
              background: "var(--surface-muted)",
              border: "1px solid var(--stroke)",
              borderRadius: "var(--radius-sm)",
              padding: "12px",
              color: "inherit",
              fontSize: "14px",
              resize: "vertical"
            }}
          />
          <p className="field-hint" style={{ marginTop: "8px" }}>
            These guidelines are automatically appended to every prompt sent to the model.
          </p>
        </div>
      </div>

      <div className="settings-section-header" style={{ marginTop: "32px" }}>
        <h2>Danger Zone</h2>
        <p>Irreversible account actions</p>
      </div>
      <div className="settings-card" style={{ border: "1px solid var(--error-text)", background: "transparent" }}>
        <div className="field">
          <button type="button" className="btn btn-danger btn-small">
            Delete Account
          </button>
          <p className="field-hint" style={{ color: "var(--error-text)", marginTop: "8px" }}>
            Permanently delete your account and all data.
          </p>
        </div>
      </div>
    </section>
  );
}
