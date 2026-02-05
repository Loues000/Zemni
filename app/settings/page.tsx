"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SettingsLayout } from "./components/SettingsLayout";
import { ClerkSignedIn, ClerkSignedOut, ClerkSignInButton } from "@/components/auth/ClerkWrapper";
import { LegalNotice } from "@/components/ui/LegalNotice";

// Prevent static generation - requires authentication
export const dynamic = 'force-dynamic';
import { AccountTab } from "./components/AccountTab";
import { SubscriptionTab } from "./components/SubscriptionTab";
import { ApiKeysTab } from "./components/ApiKeysTab";
import { NotionTab } from "./components/NotionTab";
import { HistorySyncTab } from "./components/HistorySyncTab";
import { ModelsTab } from "./components/ModelsTab";
import { CustomizationTab } from "./components/CustomizationTab";
import { ContactTab } from "./components/ContactTab";

const VALID_TABS = ["account", "subscription", "api-keys", "notion", "history", "models", "customization", "contact"];

/**
 * Renders the settings page content, showing the selected settings tab when signed in and a sign-in prompt when signed out.
 *
 * The active tab is derived from the `tab` URL query parameter (validated against the known tab list) and kept in sync with URL changes.
 *
 * @returns The React element containing either the authenticated settings layout with the active tab content or a sign-in gated UI with a sign-in button and legal notice.
 */
function SettingsContent() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : "account";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const renderTab = () => {
    switch (activeTab) {
      case "account":
        return <AccountTab />;
      case "subscription":
        return <SubscriptionTab />;
      case "api-keys":
        return <ApiKeysTab />;
      case "notion":
        return <NotionTab />;
      case "history":
        return <HistorySyncTab />;
      case "models":
        return <ModelsTab />;
      case "customization":
        return <CustomizationTab />;
      case "contact":
        return <ContactTab />;
      default:
        return <AccountTab />;
    }
  };

  return (
    <>
      <ClerkSignedIn>
        <SettingsLayout activeTab={activeTab} onTabChange={setActiveTab}>
          {renderTab()}
        </SettingsLayout>
      </ClerkSignedIn>
      <ClerkSignedOut>
        <div className="settings-page">
          <div className="settings-shell">
            <main className="settings-main" style={{ maxWidth: "600px", margin: "0 auto", padding: "48px 24px" }}>
              <div className="settings-card">
                <h2>Sign In Required</h2>
                <p>Please sign in to access your settings.</p>
                <ClerkSignInButton mode="modal">
                  <button type="button" className="btn btn-primary">
                    Sign In
                  </button>
                </ClerkSignInButton>
                <LegalNotice />
              </div>
            </main>
          </div>
        </div>
      </ClerkSignedOut>
    </>
  );
}

/**
 * Client route component for the Settings page that displays a loading fallback while the settings content loads.
 *
 * @returns A React element that renders a centered "Loading settings..." fallback UI until SettingsContent is ready, then renders the SettingsContent component.
 */
export default function SettingsRoute() {
  return (
    <Suspense fallback={
      <div className="settings-page">
        <div className="settings-shell">
          <main className="settings-main" style={{ maxWidth: "600px", margin: "0 auto", padding: "48px 24px" }}>
            <div className="settings-card">
              <p>Loading settings...</p>
            </div>
          </main>
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}