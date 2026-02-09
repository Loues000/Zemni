import { Polar } from "@polar-sh/sdk";

type PolarServer = "sandbox" | "production";

const server = process.env.POLAR_SERVER as PolarServer | undefined;

export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  ...(server ? { server } : {}),
});

// Note: "basic" tier is not a Polar-managed tier - it's automatically awarded to all logged-in users
export const TIER_PRODUCT_IDS: Record<string, string | undefined> = {
  plus: process.env.POLAR_PRODUCT_ID_PLUS,
  pro: process.env.POLAR_PRODUCT_ID_PRO,
};

export function getTierFromProductId(productId: string): "plus" | "pro" | null {
  for (const [tier, id] of Object.entries(TIER_PRODUCT_IDS)) {
    if (id === productId) {
      return tier as "plus" | "pro";
    }
  }
  return null;
}
