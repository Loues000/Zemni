import { NextResponse } from "next/server";
import { loadModels, isSubscriptionTiersEnabled, isModelAvailable } from "@/lib/models";

export const runtime = "nodejs";

/**
 * Gets the current user's subscription tier
 * TODO: Replace with actual user authentication/subscription check
 * 
 * @returns User's subscription tier (null = not logged in, "free" = logged in no sub, "basic" = basic sub, "plus" = plus sub, "pro" = pro sub)
 */
const getCurrentUserTier = async (): Promise<string | null> => {
  // TODO: Implement actual user authentication
  // Example implementation:
  // const session = await getSession(request);
  // if (!session) return null; // Not logged in
  // const user = await getUserFromDB(session.userId);
  // return user.subscriptionTier || "free"; // Logged in but no subscription = "free"

  // Current implementation: return null (not logged in) - all models available
  return null;
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
