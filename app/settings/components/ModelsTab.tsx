"use client";

import { useAppState } from "@/hooks";
import { ModelSelector } from "@/components/ui";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";

// SVG Model Icon component
function ModelIcon({ modelId }: { modelId: string }) {
  // Different model families have different visual representations
  if (modelId.includes("gpt-5") || modelId.includes("openai")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#10a37f"/>
        <path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }
  if (modelId.includes("claude") || modelId.includes("anthropic")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#cc785c"/>
        <circle cx="12" cy="12" r="5" fill="white"/>
      </svg>
    );
  }
  if (modelId.includes("gemini") || modelId.includes("google")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#4285f4"/>
        <path d="M12 7v10M7 12h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }
  if (modelId.includes("grok") || modelId.includes("x-ai")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#1d9bf0"/>
        <path d="M8 8l8 8M16 8l-8 8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }
  if (modelId.includes("kimi") || modelId.includes("moonshotai")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#4f46e5"/>
        <circle cx="9" cy="12" r="2" fill="white"/>
        <circle cx="15" cy="12" r="2" fill="white"/>
      </svg>
    );
  }
  if (modelId.includes("deepseek")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#2563eb"/>
        <path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }
  // Default model icon
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="var(--text-muted)"/>
      <rect x="7" y="7" width="10" height="10" rx="1" fill="white"/>
    </svg>
  );
}

// Get 1-line description for model based on ID
function getModelDescription(modelId: string): string {
  const descriptions: Record<string, string> = {
    "openai/gpt-5.2-chat": "Fast responses with GPT-5.2 capabilities for rapid prototyping",
    "openai/gpt-5.2": "Latest GPT model with exceptional reasoning and comprehensive knowledge",
    "openai/gpt-5.1": "Balanced performance and cost for most generation tasks",
    "openai/gpt-5-mini": "Efficient and cost-effective model for quick generations",
    "openai/gpt-5-nano": "Ultra-lightweight model optimized for speed and minimal cost",
    "openai/gpt-oss-120b:free": "Open-source 120B parameter model available at no cost",
    "openai/gpt-oss-120b": "Powerful open-source model with advanced reasoning capabilities",
    "google/gemini-3-flash-preview": "Fast and efficient multimodal model from Google",
    "google/gemini-3-pro-preview": "Advanced reasoning with superior comprehension and output quality",
    "anthropic/claude-sonnet-4.5": "Claude's balanced model for thoughtful analysis",
    "anthropic/claude-opus-4.5": "Claude's most capable model for complex reasoning",
    "x-ai/grok-4.1-fast": "High-speed model with real-time information capabilities",
    "moonshotai/kimi-k2-thinking": "Specialized model with extended context understanding",
    "moonshotai/kimi-k2.5": "Enhanced reasoning and longer context window",
    "deepseek/deepseek-v3.2": "Cost-efficient model with strong coding capabilities",
    "z-ai/glm-4.7": "Versatile model with strong multilingual support",
    "z-ai/glm-4.7-flash": "Rapid response model optimized for quick answers",
    "arcee-ai/trinity-large-preview:free": "Community model available at no cost",
  };
  
  return descriptions[modelId] || "General-purpose language model for content generation";
}

export function ModelsTab() {
  const { models, selectedModel, setSelectedModel, defaultModel, setDefaultModel } = useAppState();
  const currentUser = useQuery(api.users.getCurrentUser);
  const [searchQuery, setSearchQuery] = useState("");
  const isBillingEnabled = process.env.NEXT_PUBLIC_ENABLE_BILLING === "true";

  const subscriptionTier = currentUser?.subscriptionTier || "free";

  const availableModels = models.filter((model) => {
    if (model.isAvailable !== undefined) {
      return model.isAvailable;
    }
    if (!model.subscriptionTier) return true;
    const modelTier = model.subscriptionTier;

    if (subscriptionTier === "free") {
      return modelTier === "free";
    }
    if (subscriptionTier === "basic") {
      return modelTier === "free" || modelTier === "basic";
    }
    if (subscriptionTier === "plus") {
      return modelTier !== "pro";
    }
    return true;
  });

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    
    const query = searchQuery.toLowerCase();
    return models.filter((model) => {
      const nameMatch = model.displayName.toLowerCase().includes(query);
      const providerMatch = model.provider.toLowerCase().includes(query);
      const descMatch = getModelDescription(model.id).toLowerCase().includes(query);
      const tierMatch = (model.subscriptionTier || "").toLowerCase().includes(query);
      return nameMatch || providerMatch || descMatch || tierMatch;
    });
  }, [models, searchQuery]);

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>Models</h2>
      </div>

      <div className="settings-card">
        <div className="field">
          <label className="field-label" htmlFor="settings-default-model">
            Default Model
          </label>
          <ModelSelector
            id="settings-default-model"
            models={models}
            userTier={subscriptionTier}
            selectedModel={defaultModel || selectedModel}
            onModelChange={(modelId) => {
              setDefaultModel(modelId);
              setSelectedModel(modelId);
            }}
          />
          <p className="field-hint">This becomes the default selection on the main screen.</p>
        </div>

        <div className="settings-divider" />

        <div className="field">
          <label className="field-label">Available Models</label>
          
          {/* Search Input */}
          <div className="settings-models-search">
            <div className="settings-search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search models by name, provider, or tier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="settings-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="settings-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="settings-models-list">
            {filteredModels.length === 0 ? (
              <div className="settings-models-empty">
                No models found matching "{searchQuery}"
              </div>
            ) : (
              filteredModels.map((model) => {
                const isAvailable = availableModels.some((m) => m.id === model.id);
                const description = model.description || getModelDescription(model.id);
                
                return (
                  <div
                    key={model.id}
                    className={`settings-model-item${!isAvailable ? " unavailable" : ""}`}
                  >
                    <div className="settings-model-info">
                      <div className="settings-model-header">
                        <ModelIcon modelId={model.id} />
                        <div className="settings-model-name">{model.displayName}</div>
                        {model.subscriptionTier && (
                          <span className="settings-model-tier" data-tier={model.subscriptionTier}>
                            {model.subscriptionTier}
                          </span>
                        )}
                      </div>
                      <div className="settings-model-description">{description}</div>
                    </div>
                    {!isAvailable && (
                      <div className="settings-model-upgrade-cta">
                        <span className="settings-model-unavailable-badge">
                          {isBillingEnabled ? "Upgrade required" : "Key required"}
                        </span>
                        {isBillingEnabled ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            onClick={() => {
                              window.location.href = "/settings?tab=subscription";
                            }}
                          >
                            Upgrade
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => {
                              window.location.href = "/settings?tab=api-keys";
                            }}
                          >
                            Add API Key
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
