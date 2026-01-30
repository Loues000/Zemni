"use client";

import { ReactNode, useState } from "react";
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
  { id: "contact", label: "Contact Us" },
] as const;

export function SettingsLayout({ children, activeTab, onTabChange }: SettingsLayoutProps) {
  const { user, isLoaded } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);
  const usageStats = useQuery(api.usage.getUsageStats, {});
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

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
          <Link href="/" className="btn btn-text btn-small settings-back-link">
            ← Back to Chat
          </Link>
        </div>
        <div className="settings-header-right">
          <div className="settings-sidebar-actions">
            {isClerkConfigured ? (
              <SignOutButton>
                <button type="button" className="btn btn-text btn-small settings-sign-out-btn">
                  Sign out
                </button>
              </SignOutButton>
            ) : (
              <button type="button" className="btn btn-text btn-small settings-sign-out-btn" disabled>
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
            <div className="settings-avatar-large">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt={user.fullName || "User"} />
              ) : (
                <div className="settings-avatar-initial">
                  {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0] || "U"}
                </div>
              )}
            </div>
            <h2 className="settings-profile-name">
              {user?.fullName || "User"}
            </h2>
            <p className="settings-profile-email">
              {user?.emailAddresses[0]?.emailAddress}
            </p>
            <div className={`tier-badge tier-badge-${subscriptionTier} settings-tier-badge-inline`}>
              {tierLabels[subscriptionTier]} Plan
            </div>
          </div>

          {/* Persistent Usage Section */}
          {usageStats && (
            <div className="settings-sidebar-usage">
              <div className="settings-usage-header">
                <span className="settings-usage-title">Usage</span>
                <span className="settings-usage-subtitle">This month</span>
              </div>

              <div className="settings-usage-metric">
                <div className="settings-usage-metric-row">
                  <span className="settings-usage-metric-label">Documents</span>
                  <span>{usageStats.thisMonthDocuments}</span>
                </div>
              </div>

              <div className="settings-usage-metric">
                <div className="settings-usage-metric-row">
                  <span className="settings-usage-metric-label">Tokens</span>
                  <span>{(usageStats.thisMonthTokensIn + usageStats.thisMonthTokensOut).toLocaleString()}</span>
                </div>
              </div>

              <button
                type="button"
                className="settings-buy-credits-btn accent"
                onClick={() => onTabChange("subscription")}
              >
                View subscription →
              </button>
            </div>
          )}

          <div className="settings-sidebar-footer">
            <button
              type="button"
              className="settings-shortcuts-toggle"
              onClick={() => setShortcutsOpen(!shortcutsOpen)}
            >
              <span>Keyboard Shortcuts</span>
              <span className={`settings-shortcuts-toggle-icon${shortcutsOpen ? " open" : ""}`}>▼</span>
            </button>
            <div className={`settings-shortcuts-content${shortcutsOpen ? " open" : ""}`}>
              <div className="settings-shortcut">
                <span>Generate</span>
                <kbd>Ctrl G</kbd>
              </div>
              <div className="settings-shortcut">
                <span>Toggle Sidebar</span>
                <kbd>Ctrl B</kbd>
              </div>
              <div className="settings-shortcut">
                <span>Search History</span>
                <kbd>Ctrl K</kbd>
              </div>
              <div className="settings-shortcut">
                <span>Copy Summary</span>
                <kbd>Ctrl C</kbd>
              </div>
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
