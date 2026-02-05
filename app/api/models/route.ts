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

/**
 * Builds a JSON payload listing models with access metadata tailored to the current user.
 *
 * Each model entry includes identifying and display fields plus availability information derived from
 * the user's subscription tier and active API key providers.
 *
 * @returns A JSON response with a `models` array where each item contains:
 * - `id`, `name`, `provider`, `displayName`, `tokenizer`, `pricing`
 * - `subscriptionTier` (if the model is tiered)
 * - `isAvailable` (`true` if the model can be used by the current user)
 * - `isCoveredBySubscription` (`true` if access is granted via the user's subscription)
 * - `requiresOwnKey` (`true` if the model requires the user's own API key and is available)
 * - `requiredTier` (the tier required to unlock the model, when not available)
 */
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