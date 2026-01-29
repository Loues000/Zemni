"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser, SignOutButton } from "@clerk/nextjs";

// Safely check if Clerk is configured
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = !!(
  clerkKey &&
  clerkKey.startsWith("pk_") &&
  !clerkKey.includes("YOUR_CLERK_PUBLISHABLE_KEY")
);

interface SettingsLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { id: "account", label: "Account" },
  { id: "subscription", label: "Subscription" },
  { id: "api-keys", label: "API Keys" },
  { id: "notion", label: "Notion" },
  { id: "history", label: "History & Sync" },
  { id: "models", label: "Models" },
  { id: "customization", label: "Customization" },
  { id: "attachments", label: "Attachments" },
  { id: "contact", label: "Contact Us" },
] as const;

export function SettingsLayout({ children, activeTab, onTabChange }: SettingsLayoutProps) {
  const { user, isLoaded } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);
  const usageStats = useQuery(api.usage.getUsageStats, {});

  const subscriptionTier = currentUser?.subscriptionTier || "free";
  const tierLabels: Record<string, string> = {
    free: "Free",
    basic: "Basic",
    plus: "Plus",
    pro: "Pro",
  };

  return (
    <div className="settings-page">
      <header className="settings-header-bar">
        <div className="settings-header-left">
          <Link href="/" className="btn btn-text btn-small" style={{ opacity: 0.7, fontWeight: 500 }}>
            ← Back to Chat
          </Link>
        </div>
        <div className="settings-header-right">
          <div className="settings-sidebar-actions">
            {isClerkConfigured ? (
              <SignOutButton>
                <button type="button" className="btn btn-text btn-small" style={{ opacity: 0.6, fontSize: "12px" }}>
                  Sign out
                </button>
              </SignOutButton>
            ) : (
              <button type="button" className="btn btn-text btn-small" disabled style={{ opacity: 0.4, fontSize: "12px" }}>
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="settings-shell">
        <aside className="settings-sidebar">
          {/* Persistent Profile Section */}
          <div className="settings-sidebar-profile">
            <div className="settings-avatar" style={{ width: "80px", height: "80px", borderRadius: "50%", marginBottom: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", fontSize: "32px" }}>
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt={user.fullName || "User"} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0] || "U"}
                </div>
              )}
            </div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 2px", color: "var(--text-primary)" }}>
              {user?.fullName || "User"}
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 12px", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
              {user?.emailAddresses[0]?.emailAddress}
            </p>
            <div className="tier-badge tier-badge-pro" style={{ fontSize: "11px", padding: "2px 8px" }}>
              {tierLabels[subscriptionTier]} Plan
            </div>
          </div>

          {/* Persistent Usage Section */}
          {usageStats && (
            <div className="settings-sidebar-usage">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>Usage</span>
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Monthly credits</span>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                  <span style={{ fontWeight: "500", opacity: 0.8 }}>Standard</span>
                  <span>{usageStats.totalDocuments}/1,500</span>
                </div>
                <div className="usage-bar-container" style={{ margin: "4px 0" }}>
                  <div
                    className="usage-bar-fill standard"
                    style={{ width: `${Math.min((usageStats.totalDocuments / 1500) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                  <span style={{ fontWeight: "500", opacity: 0.8 }}>Premium</span>
                  <span>{Math.floor(usageStats.thisMonthTokensIn / 1000)}/100</span>
                </div>
                <div className="usage-bar-container" style={{ margin: "4px 0" }}>
                  <div
                    className="usage-bar-fill premium"
                    style={{ width: `${Math.min((usageStats.thisMonthTokensIn / 100000) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="settings-buy-credits-btn"
                onClick={() => onTabChange("subscription")}
                style={{ background: "var(--accent)", color: "white" }}
              >
                Top up credits →
              </button>
            </div>
          )}

          <div className="settings-sidebar-footer" style={{ marginTop: "auto", paddingTop: "24px" }}>
            <div className="settings-sidebar-section-title" style={{ fontSize: "11px", fontWeight: "700", opacity: 0.6, marginBottom: "12px" }}>Keyboard Shortcuts</div>
            <div className="settings-shortcut" style={{ padding: "6px 0", fontSize: "12px", display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
              <span>Search</span>
              <kbd style={{ background: "transparent", border: "1px solid var(--stroke)", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>Ctrl K</kbd>
            </div>
            <div className="settings-shortcut" style={{ padding: "6px 0", fontSize: "12px", display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
              <span>New Chat</span>
              <kbd style={{ background: "transparent", border: "1px solid var(--stroke)", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>Ctrl Shift O</kbd>
            </div>
            <div className="settings-shortcut" style={{ padding: "6px 0", fontSize: "12px", display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
              <span>Toggle Sidebar</span>
              <kbd style={{ background: "transparent", border: "1px solid var(--stroke)", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>Ctrl B</kbd>
            </div>
            <div className="settings-shortcut" style={{ padding: "6px 0", fontSize: "12px", display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
              <span>Open Model Picker</span>
              <kbd style={{ background: "transparent", border: "1px solid var(--stroke)", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>Ctrl /</kbd>
            </div>
          </div>
        </aside>

        <main className="settings-main">
          {/* Horizontal Tabs */}
          <nav className="settings-tabs-horizontal" aria-label="Settings sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`settings-tab-horizontal${activeTab === tab.id ? " active" : ""}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="settings-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
