import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-01-28.clover" as const,
});

export const TIER_PRICE_IDS: Record<string, string> = {
  basic: process.env.STRIPE_PRICE_ID_BASIC || "",
  plus: process.env.STRIPE_PRICE_ID_PLUS || "",
  pro: process.env.STRIPE_PRICE_ID_PRO || "",
};

export type SubscriptionTier = "free" | "basic" | "plus" | "pro";
