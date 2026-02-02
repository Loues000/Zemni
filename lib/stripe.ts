import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

export const TIER_PRICE_IDS: Record<string, string | undefined> = {
  basic: process.env.STRIPE_PRICE_ID_BASIC,
  plus: process.env.STRIPE_PRICE_ID_PLUS,
  pro: process.env.STRIPE_PRICE_ID_PRO,
};

export function getTierFromPriceId(priceId: string): "free" | "basic" | "plus" | "pro" | null {
  for (const [tier, id] of Object.entries(TIER_PRICE_IDS)) {
    if (id === priceId) {
      return tier as "basic" | "plus" | "pro";
    }
  }
  return null;
}
