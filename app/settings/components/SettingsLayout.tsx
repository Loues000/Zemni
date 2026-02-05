"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { ToastProvider } from "./ToastProvider";
import { LegalLinks } from "@/components/ui/LegalLinks";

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

/**
 * Calculate the next billing cycle reset date based on account/subscription creation
 */
function getNextResetDate(user: { createdAt: number; subscriptionStartDate?: number } | null | undefined): Date {
  if (!user) {
    // Fallback to next month if no user data
    return new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  }

  // Use subscription start date for paid users, otherwise use account creation date
  const startDate = user.subscriptionStartDate || user.createdAt;
  const start = new Date(startDate);
  
  // Get the day of month from the start date (e.g., 15th)
  const dayOfMonth = start.getDate();
  
  // Calculate next reset date
  const now = new Date();
  let nextReset = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  nextReset.setHours(0, 0, 0, 0);
  
  // If we've already passed this month's reset date, use next month
  if (nextReset.getTime() <= now.getTime()) {
    nextReset = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
    nextReset.setHours(0, 0, 0, 0);
    
    // Handle edge case: if day doesn't exist in next month (e.g., Jan 31 -> Feb 31)
    // JavaScript Date will auto-adjust (Feb 31 becomes Mar 3), so check if month changed
    if (nextReset.getMonth() !== (now.getMonth() + 1) % 12) {
      // Day doesn't exist, use last day of the month instead
      nextReset = new Date(now.getFullYear(), now.getMonth() + 2, 0); // Day 0 = last day of previous month
      nextReset.setHours(0, 0, 0, 0);
    }
  } else {
    // Handle edge case for current month too
    if (nextReset.getMonth() !== now.getMonth()) {
      // Day doesn't exist in current month, use last day of current month
      nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      nextReset.setHours(0, 0, 0, 0);
    }
  }
  
  return nextReset;
}

/**
 * Layout wrapper for the settings area with sidebar and tabs.
 */
export function SettingsLayout({ children, activeTab, onTabChange }: SettingsLayoutProps) {
  const { user } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);
  const monthlyUsage = useQuery(api.usage.getMonthlyGenerationCount, {});
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const subscriptionTier = currentUser?.subscriptionTier || "free";
  const tierLabels: Record<string, string> = {
    free: "Free",
    basic: "Basic",
    plus: "Plus",
    pro: "Pro",
  };

  const nextResetDate = getNextResetDate(currentUser);

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
            {monthlyUsage && (
              <div className="settings-sidebar-usage">
                <div className="settings-usage-header">
                  <div className="settings-usage-label">Monthly Generations</div>
                  <div className="settings-usage-count">
                    {monthlyUsage.count} / {monthlyUsage.limit}
                  </div>
                </div>
                <div className="settings-usage-progress-container">
                  <div 
                    className="settings-usage-progress-bar"
                    style={{
                      width: `${Math.min(100, (monthlyUsage.count / monthlyUsage.limit) * 100)}%`,
                      backgroundColor: 
                        monthlyUsage.count / monthlyUsage.limit >= 0.8 
                          ? "var(--error-text)" 
                          : monthlyUsage.count / monthlyUsage.limit >= 0.5
                          ? "var(--warning)"
                          : "var(--accent)"
                    }}
                  />
                </div>
                {monthlyUsage.count >= monthlyUsage.limit && (
                  <div className="settings-usage-warning" style={{ marginTop: "8px", fontSize: "0.875rem", color: "var(--error-text)" }}>
                    Limit reached. Paid tiers are coming soon.
                  </div>
                )}
                {monthlyUsage.count < monthlyUsage.limit && monthlyUsage.count / monthlyUsage.limit >= 0.8 && (
                  <div className="settings-usage-warning" style={{ marginTop: "8px", fontSize: "0.875rem", color: "var(--warning-text)" }}>
                    {monthlyUsage.limit - monthlyUsage.count} remaining
                  </div>
                )}
                <div className="settings-usage-reset" style={{ marginTop: "8px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Resets {nextResetDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
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
        <footer className="settings-footer">
          <LegalLinks />
        </footer>
      </div>
    </ToastProvider>
  );
}
