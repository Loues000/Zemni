"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { IconCheck } from "@/components/ui/Icons";

export function SubscriptionTab() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const [loading, setLoading] = useState(false);

  const subscriptionTier = currentUser?.subscriptionTier || "free";
  const tierLabels: Record<string, string> = {
    free: "Free",
    basic: "Basic",
    plus: "Plus",
    pro: "Pro",
  };

  const handleUpgrade = async (tier: "basic" | "plus" | "pro") => {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        console.error("Failed to create checkout session:", data.error);
        alert(`Failed to create checkout session: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to create checkout session:", error);
      alert("Failed to create checkout session. Please try again.");
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
            {subscriptionTier !== "pro" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  // Determine next tier to upgrade to
                  const nextTier = subscriptionTier === "free" ? "basic" : subscriptionTier === "basic" ? "plus" : "pro";
                  handleUpgrade(nextTier);
                }}
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
        </div>


        <div className="settings-divider" />
        <div className="field">
          <label className="field-label">Subscription Tiers</label>
          <div className="settings-tiers-comparison">
            <div className={`settings-tier-card${subscriptionTier === "free" ? " active" : ""}`} data-tier="free">
              <div className="settings-tier-card-header">
                <h3>Free</h3>
                {subscriptionTier === "free" && <span className="settings-tier-badge-current">Current</span>}
              </div>
              <ul className="settings-tier-features">
                <li><IconCheck /> Access to free-tier models</li>
                <li><IconCheck /> Basic summary generation</li>
                <li><IconCheck /> Standard support</li>
              </ul>
              {subscriptionTier === "free" ? (
                <button type="button" className="btn btn-secondary btn-small" disabled>
                  Current Plan
                </button>
              ) : (
                <button type="button" className="btn btn-secondary btn-small" disabled>
                  Downgrade
                </button>
              )}
            </div>

            <div className={`settings-tier-card${subscriptionTier === "basic" ? " active" : ""}`} data-tier="basic">
              <div className="settings-tier-card-header">
                <h3>Basic</h3>
                {subscriptionTier === "basic" && <span className="settings-tier-badge-current">Current</span>}
              </div>
              <ul className="settings-tier-features">
                <li><IconCheck /> All free-tier models</li>
                <li><IconCheck /> Gemini 1.5 Flash & more</li>
                <li><IconCheck /> Enhanced generation quality</li>
                <li><IconCheck /> Priority support</li>
              </ul>
              {subscriptionTier === "basic" ? (
                <button type="button" className="btn btn-secondary btn-small" disabled>
                  Current Plan
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => handleUpgrade("basic")}
                  disabled={loading || subscriptionTier !== "free"}
                >
                  {loading ? "Loading..." : subscriptionTier === "free" ? "Upgrade" : "Switch Plan"}
                </button>
              )}
            </div>

            <div className={`settings-tier-card${subscriptionTier === "plus" ? " active" : ""}`} data-tier="plus">
              <div className="settings-tier-card-header">
                <h3>Plus</h3>
                {subscriptionTier === "plus" && <span className="settings-tier-badge-current">Current</span>}
              </div>
              <ul className="settings-tier-features">
                <li><IconCheck /> All free & basic models</li>
                <li><IconCheck /> Claude 3.5 Sonnet</li>
                <li><IconCheck /> GPT-4o-mini</li>
                <li><IconCheck /> Advanced generation features</li>
                <li><IconCheck /> Faster processing</li>
                <li><IconCheck /> Priority support</li>
              </ul>
              {subscriptionTier === "plus" ? (
                <button type="button" className="btn btn-secondary btn-small" disabled>
                  Current Plan
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => handleUpgrade("plus")}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Upgrade"}
                </button>
              )}
            </div>

            <div className={`settings-tier-card${subscriptionTier === "pro" ? " active" : ""}`} data-tier="pro">
              <div className="settings-tier-card-header">
                <h3>Pro</h3>
                {subscriptionTier === "pro" && <span className="settings-tier-badge-current">Current</span>}
              </div>
              <ul className="settings-tier-features">
                <li><IconCheck /> Access to ALL models</li>
                <li><IconCheck /> GPT-4o, Claude 3 Opus</li>
                <li><IconCheck /> Gemini 1.5 Pro</li>
                <li><IconCheck /> Maximum generation quality</li>
                <li><IconCheck /> Fastest processing</li>
                <li><IconCheck /> Premium support</li>
                <li><IconCheck /> Early access to features</li>
              </ul>
              {subscriptionTier === "pro" ? (
                <button type="button" className="btn btn-secondary btn-small" disabled>
                  Current Plan
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => handleUpgrade("pro")}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Upgrade"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

