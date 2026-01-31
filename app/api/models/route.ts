import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadModels, isSubscriptionTiersEnabled, isModelAvailable } from "@/lib/models";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Gets the current user's subscription tier
 * 
 * @returns User's subscription tier (null = not logged in, "free" = logged in no sub, "basic" = basic sub, "plus" = plus sub, "pro" = pro sub)
 */
const getCurrentUserTier = async (): Promise<string | null> => {
  const { userId } = await auth();
  if (!userId) return null; // Not logged in = free tier (null)
  
  const user = await convex.query(api.users.getUserByClerkUserId, {
    clerkUserId: userId,
  });
  
  return user?.subscriptionTier || "free";
};

export async function GET() {
  const models = await loadModels();
  const tiersEnabled = isSubscriptionTiersEnabled();

  // Get current user's tier (TODO: implement actual auth)
  const userTier = await getCurrentUserTier();

  const mappedModels = models.map((model) => {
    // Check if model is available for current user
    const isAvailable = isModelAvailable(model, userTier);

    // Determine required tier for locked models
    const requiredTier = !isAvailable && model.subscriptionTier
      ? model.subscriptionTier
      : undefined;

    return {
      id: model.openrouterId,
      name: model.name,
      provider: model.provider,
      displayName: model.displayName || `${model.provider}/${model.name}`,
      tokenizer: model.tokenizer,
      pricing: model.pricing,
      subscriptionTier: model.subscriptionTier,
      isAvailable,
      requiredTier
    };
  });

  return NextResponse.json({
    models: mappedModels
  });
}
