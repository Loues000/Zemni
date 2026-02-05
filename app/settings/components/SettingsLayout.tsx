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
 * Compute the next billing-cycle reset date for a user account.
 *
 * Uses the user's subscriptionStartDate when present, otherwise the account createdAt date,
 * and returns the next calendar date whose day-of-month matches that start day. If that day
 * does not exist in the target month (e.g., 31st in a shorter month), the last day of the
 * applicable month is used. When `user` is null or undefined, returns the first day of the
 * next month.
 *
 * The returned Date is normalized to midnight (00:00:00) in the local timezone.
 *
 * @param user - Object containing `createdAt` (timestamp) and an optional `subscriptionStartDate` (timestamp)
 * @returns The next reset Date at midnight for the current billing cycle (in the current or next month)
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
 * Render the settings page layout with user profile, subscription usage, and horizontal tab navigation.
 *
 * Renders a sidebar with the user's avatar, name, tier badge, and monthly usage visualization; a header with a back link and sign-out control; a main area with tabs and provided children; and a footer with legal links.
 *
 * @param children - The content to display in the main settings content area for the active tab.
 * @param activeTab - The id of the currently active tab.
 * @param onTabChange - Callback invoked with a tab id when the user selects a different tab.
 * @returns The rendered settings page element.
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