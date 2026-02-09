import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { loadModels } from "@/lib/models";
import { getModelAvailability, type ApiProvider } from "@/lib/model-availability";
import { api } from "@/convex/_generated/api";


export const runtime = "nodejs";

/**
 * Gets the current user's subscription tier and API keys
 * 
 * @returns Object with user's subscription tier and API key providers
 */
const getCurrentUserContext = async (): Promise<{ 
  userTier: string | null; 
  apiKeyProviders: ApiProvider[];
}> => {
  const { userId, getToken } = await auth();
  if (!userId) return { userTier: null, apiKeyProviders: [] }; // Not logged in

  const convexToken = await getToken({ template: "convex" });
  if (!convexToken) return { userTier: null, apiKeyProviders: [] };

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(convexToken);

  const user = await convex.query(api.users.getCurrentUser, {});
  
  // Get user's active API key providers
  const activeProviders = await convex.query(api.apiKeys.getActiveProviders, {});
  const apiKeyProviders = activeProviders.map((p: { provider: ApiProvider }) => p.provider);
  
  return { 
    userTier: user?.subscriptionTier || "free",
    apiKeyProviders 
  };
};

/**
 * Return available model metadata and per-user availability flags.
 */
export async function GET() {
  const models = await loadModels();

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
