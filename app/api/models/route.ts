import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadModels, isSubscriptionTiersEnabled } from "@/lib/models";
import { getModelAvailability, type ApiProvider } from "@/lib/model-availability";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

// Create unauthenticated Convex client (auth happens via clerkUserId param)
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Gets the current user's subscription tier and API keys
 * 
 * @returns Object with user's subscription tier and API key providers
 */
const getCurrentUserContext = async (): Promise<{ 
  userTier: string | null; 
  apiKeyProviders: ApiProvider[];
}> => {
  const { userId } = await auth();
  if (!userId) return { userTier: null, apiKeyProviders: [] }; // Not logged in
  
  const user = await convex.query(api.users.getUserByClerkUserId, {
    clerkUserId: userId,
  });
  
  // Get user's active API key providers
  const activeProviders = await convex.query(api.apiKeys.getActiveProviders, { 
    clerkUserId: userId 
  });
  const apiKeyProviders = activeProviders.map((p: { provider: ApiProvider }) => p.provider);
  
  return { 
    userTier: user?.subscriptionTier || "free",
    apiKeyProviders 
  };
};

export async function GET() {
  const models = await loadModels();
  const tiersEnabled = isSubscriptionTiersEnabled();

  // Get current user's tier and API keys
  const { userTier, apiKeyProviders } = await getCurrentUserContext();

  const mappedModels = models.map((model) => {
    // Check full model availability (subscription + API keys)
    const availability = getModelAvailability(
      { 
        id: model.openrouterId, 
        subscriptionTier: model.subscriptionTier 
      }, 
      userTier,
      apiKeyProviders
    );

    // Determine required tier for locked models
    const requiredTier = !availability.isAvailable && model.subscriptionTier
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
      isAvailable: availability.isAvailable,
      isCoveredBySubscription: availability.isCoveredBySubscription,
      requiresOwnKey: availability.requiresOwnKey && availability.isAvailable,
      requiredTier
    };
  });

  return NextResponse.json({
    models: mappedModels
  });
}
