"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { IconCheck } from "@/components/ui/Icons";
import { useToastContext } from "./ToastProvider";

/**
 * Display subscription status and management options.
 */
export function SubscriptionTab() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const [loading, setLoading] = useState(false);
  const [tierChangeNotification, setTierChangeNotification] = useState<string | null>(null);
  const previousTierRef = useRef<string | undefined>(undefined);
  const toast = useToastContext();
  const isBillingEnabled = process.env.NEXT_PUBLIC_ENABLE_BILLING === "true";

  const subscriptionTier = currentUser?.subscriptionTier || "free";

  // Detect tier changes and show notification (Convex queries are reactive, so this will trigger on webhook updates)
  useEffect(() => {
    if (previousTierRef.current !== undefined && previousTierRef.current !== subscriptionTier) {
      const tierLabels: Record<string, string> = {
        free: "Free",
        basic: "Basic",
        plus: "Plus",
        pro: "Pro",
      };
      const message = `Subscription updated to ${tierLabels[subscriptionTier]} plan`;
      setTierChangeNotification(message);
      toast.success(message);
      setTimeout(() => setTierChangeNotification(null), 5000);
    }
    previousTierRef.current = subscriptionTier;
  }, [subscriptionTier, toast]);
  const tierLabels: Record<string, string> = {
    free: "Free",
    basic: "Basic",
    plus: "Plus",
    pro: "Pro",
  };

  const [error, setError] = useState<string | null>(null);

  /**
   * Open the Polar customer portal for subscription management.
   */
  const handleManageSubscription = async () => {
    setLoading(true);
    setError(null);
    toast.info("Opening subscription management...", 3000);
    try {
      const response = await fetch("/api/polar/portal", {
        method: "POST",
      });
      const data = await response.json();
      if (data.url) {
        setTimeout(() => {
          window.location.href = data.url;
        }, 100);
      } else if (data.error) {
        const errorMessage = data.error.includes("No active subscription")
          ? "You don't have an active subscription to manage."
          : data.error.includes("Unauthorized")
          ? "Please sign in to manage your subscription."
          : "Unable to open subscription management. Please try again or contact support.";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Failed to create portal session:", error);
      const errorMessage = "Network error. Please check your connection and try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>Subscription</h2>
      </div>

      {tierChangeNotification && (
        <div className="settings-notice success" style={{ marginBottom: "16px" }}>
          {tierChangeNotification}
        </div>
      )}

      {error && (
        <div className="settings-notice error" style={{ marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {!isBillingEnabled && (
        <div className="settings-notice info" style={{ marginBottom: "16px" }}>
          Subscriptions are coming soon. No purchases are available yet. You can still unlock more
          models with your own API keys in Settings → API Keys.
        </div>
      )}

      <div className="settings-card">
        <div className="field">
          <label className="field-label">Current Plan</label>
          <div className="settings-tier-display" style={{ justifyContent: "center" }}>
            <span className="settings-tier-badge-large" data-tier={subscriptionTier}>
              {tierLabels[subscriptionTier]}
            </span>
            {(subscriptionTier === "plus" || subscriptionTier === "pro") && (
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
            <div className={`settings-tier-card${subscriptionTier === "basic" ? " active" : ""}`} data-tier="basic">
              <div className="settings-tier-card-header">
                <h3>Basic</h3>
                {subscriptionTier === "basic" && <span className="settings-tier-badge-current">Current</span>}
              </div>
              <ul className="settings-tier-features">
                <li><IconCheck /> 20 generations/month</li>
                <li><IconCheck /> All free-tier models</li>
                <li><IconCheck /> Gemini 3 Flash, DeepSeek V3.2</li>
                <li><IconCheck /> Kimi K2.5, GLM 4.7</li>
              </ul>
              <p className="settings-tier-note" style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "8px" }}>
                Currently unavailable. Subscriptions are coming soon.
              </p>
              <button type="button" className="btn btn-secondary btn-small" disabled>
                {subscriptionTier === "basic" ? "Current Plan" : "Coming Soon"}
              </button>
            </div>

            <div className={`settings-tier-card${subscriptionTier === "plus" ? " active" : ""}`} data-tier="plus">
              <div className="settings-tier-card-header">
                <h3>Plus</h3>
                <div className="settings-tier-price">$8/mo</div>
                {subscriptionTier === "plus" && <span className="settings-tier-badge-current">Current</span>}
                {subscriptionTier !== "plus" && <span className="settings-tier-badge-popular">Most Popular</span>}
              </div>
              <ul className="settings-tier-features">
                <li><IconCheck /> 100 generations/month</li>
                <li><IconCheck /> All free & basic models</li>
                <li><IconCheck /> GPT-5.1, Claude Sonnet 4.5</li>
              </ul>
              <button type="button" className="btn btn-secondary btn-small" disabled>
                {subscriptionTier === "plus" ? "Current Plan" : "Coming Soon"}
              </button>
            </div>

            <div className={`settings-tier-card${subscriptionTier === "pro" ? " active" : ""}`} data-tier="pro">
              <div className="settings-tier-card-header">
                <h3>Pro</h3>
                <div className="settings-tier-price">$14/mo</div>
                {subscriptionTier === "pro" && <span className="settings-tier-badge-current">Current</span>}
                {subscriptionTier !== "pro" && <span className="settings-tier-badge-elite">Elite</span>}
              </div>
              <ul className="settings-tier-features">
                <li><IconCheck /> 200 generations/month</li>
                <li><IconCheck /> Access to ALL models</li>
                <li><IconCheck /> GPT-5.2, Claude Opus 4.5</li>
                <li><IconCheck /> Gemini 3 Pro, GPT OSS 120B</li>
              </ul>
              <button type="button" className="btn btn-secondary btn-small" disabled>
                {subscriptionTier === "pro" ? "Current Plan" : "Coming Soon"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

