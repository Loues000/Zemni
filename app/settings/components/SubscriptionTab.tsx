"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function SubscriptionTab() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const usageStats = useQuery(api.usage.getUsageStats, {});
  const [loading, setLoading] = useState(false);

  const subscriptionTier = currentUser?.subscriptionTier || "free";
  const tierLabels: Record<string, string> = {
    free: "Free",
    basic: "Basic",
    plus: "Plus",
    pro: "Pro",
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to create checkout session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to create portal session:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>Subscription</h2>
        <p>Manage your subscription tier and view usage statistics</p>
      </div>

      <div className="settings-card">
        <div className="field">
          <label className="field-label">Current Plan</label>
          <div className="settings-tier-display">
            <span className="settings-tier-badge-large" data-tier={subscriptionTier}>
              {tierLabels[subscriptionTier]}
            </span>
          </div>
          {subscriptionTier !== "pro" && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? "Loading..." : "Upgrade Plan"}
            </button>
          )}
          {currentUser?.stripeSubscriptionId && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleManageSubscription}
              disabled={loading}
            >
              {loading ? "Loading..." : "Manage Subscription"}
            </button>
          )}
        </div>

        {usageStats && (
          <>
            <div className="settings-divider" />
            <div className="field">
              <label className="field-label">Usage Statistics</label>
              <div className="settings-stats-grid">
                <div className="settings-stat">
                  <div className="settings-stat-label">Total Documents</div>
                  <div className="settings-stat-value">{usageStats.totalDocuments}</div>
                </div>
                <div className="settings-stat">
                  <div className="settings-stat-label">This Month</div>
                  <div className="settings-stat-value">{usageStats.thisMonthDocuments}</div>
                </div>
                <div className="settings-stat">
                  <div className="settings-stat-label">Total Tokens</div>
                  <div className="settings-stat-value">
                    {(usageStats.totalTokensIn + usageStats.totalTokensOut).toLocaleString()}
                  </div>
                </div>
                <div className="settings-stat">
                  <div className="settings-stat-label">This Month</div>
                  <div className="settings-stat-value">
                    {(usageStats.thisMonthTokensIn + usageStats.thisMonthTokensOut).toLocaleString()}
                  </div>
                </div>
                <div className="settings-stat">
                  <div className="settings-stat-label">Total Cost</div>
                  <div className="settings-stat-value">${usageStats.totalCost.toFixed(2)}</div>
                </div>
                <div className="settings-stat">
                  <div className="settings-stat-label">This Month</div>
                  <div className="settings-stat-value">${usageStats.thisMonthCost.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="settings-divider" />
        <div className="field">
          <label className="field-label">Plan Benefits</label>
          <div className="settings-benefits">
            <div className="settings-benefit">
              <strong>Free:</strong> Access to free-tier models only
            </div>
            <div className="settings-benefit">
              <strong>Basic:</strong> Free + basic-tier models
            </div>
            <div className="settings-benefit">
              <strong>Plus:</strong> Free + basic + plus-tier models
            </div>
            <div className="settings-benefit">
              <strong>Pro:</strong> Access to all models including pro-tier
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
