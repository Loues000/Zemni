"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { ToastProvider } from "./ToastProvider";

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
  const { user } = useUser();
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
    <ToastProvider>
      <div className="settings-page">
        <header className="settings-header-bar">
          <div className="settings-header-left">
            <Link href="/" className="btn btn-text btn-small settings-back-link">
              Back to Chat
            </Link>
          </div>
          <div className="settings-header-right">
            {isClerkConfigured ? (
              <SignOutButton>
                <button type="button" className="btn btn-text btn-small">Sign out</button>
              </SignOutButton>
            ) : (
              <button type="button" className="btn btn-text btn-small" disabled>Sign out</button>
            )}
          </div>
        </header>
        <div className="settings-shell">
          <aside className="settings-sidebar">
            <div className="settings-sidebar-profile">
              <div className="settings-avatar-large">
                {user?.imageUrl ? (
                  <img 
                    src={user.imageUrl} 
                    alt={user?.fullName || "Profile"} 
                    className="settings-avatar-image"
                  />
                ) : (
                  <div className="settings-avatar-placeholder">
                    {(user?.fullName || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="settings-profile-name">{user?.fullName || "User"}</div>
              <div className={`tier-badge tier-badge-${subscriptionTier}`}>{tierLabels[subscriptionTier]} Plan</div>
            </div>
            {usageStats && (
              <div className="settings-sidebar-usage">
                <div>Documents: {usageStats.thisMonthDocuments}</div>
                <div>Tokens: {(usageStats.thisMonthTokensIn + usageStats.thisMonthTokensOut).toLocaleString()}</div>
              </div>
            )}
          </aside>
          <main className="settings-main">
            <nav className="settings-tabs-horizontal">
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
    </ToastProvider>
  );
}
