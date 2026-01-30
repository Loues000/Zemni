"use client";

import { useAppState } from "@/hooks";
import { ModelSelector, ProviderIcon } from "@/components/ui";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function ModelsTab() {
  const { models, selectedModel, setSelectedModel, defaultModel, setDefaultModel } = useAppState();
  const currentUser = useQuery(api.users.getCurrentUser);

  const subscriptionTier = currentUser?.subscriptionTier || "free";

  const availableModels = models.filter((model) => {
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
    return true; // pro has access to all
  });

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>Models</h2>
        <p>Configure default model preferences</p>
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
          <div className="settings-models-list">
            {models.map((model) => {
              const isAvailable = availableModels.some((m) => m.id === model.id);
              return (
                <div
                  key={model.id}
                  className={`settings-model-item${!isAvailable ? " unavailable" : ""}`}
                >
                  <div className="settings-model-info">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <ProviderIcon provider={model.provider} />
                      <div className="settings-model-name">{model.displayName}</div>
                    </div>
                    <div className="settings-model-meta">
                      {model.subscriptionTier && (
                        <span className="settings-model-tier" data-tier={model.subscriptionTier}>
                          {model.subscriptionTier}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isAvailable && (
                    <div className="settings-model-upgrade-cta">
                      <span className="settings-model-unavailable-badge">Upgrade required</span>
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={() => {
                          // Navigate to subscription tab
                          const subTab = document.querySelector('[data-tab-id="subscription"]') as HTMLButtonElement;
                          if (subTab) subTab.click();
                        }}
                      >
                        Upgrade
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
