"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { IconCheck } from "@/components/ui/Icons";
import { useToastContext } from "./ToastProvider";

export function SubscriptionTab() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const [loading, setLoading] = useState(false);
  const [tierChangeNotification, setTierChangeNotification] = useState<string | null>(null);
  const previousTierRef = useRef<string | undefined>(undefined);
  const toast = useToastContext();

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

  const handleUpgrade = async (tier: "basic" | "plus" | "pro") => {
    setLoading(true);
    setError(null);
    // Show loading message
    toast.info("Redirecting to checkout...", 3000);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await response.json();
      if (data.url) {
        // Small delay to show the loading message
        setTimeout(() => {
          window.location.href = data.url;
        }, 100);
      } else if (data.error) {
        console.error("Failed to create checkout session:", data.error);
        // Provide user-friendly error messages
        const errorMessage = data.error.includes("Price ID")
          ? "Subscription pricing is not configured. Please contact support."
          : data.error.includes("Unauthorized")
          ? "Please sign in to upgrade your subscription."
          : data.error.includes("not found")
          ? "Account not found. Please try signing out and back in."
          : "Unable to start checkout. Please try again or contact support if the problem persists.";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Failed to create checkout session:", error);
      const errorMessage = "Network error. Please check your connection and try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    setError(null);
    toast.info("Opening subscription management...", 3000);
    try {
      const response = await fetch("/api/stripe/portal", {
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
        <p>Manage your subscription tier and view usage statistics</p>
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

