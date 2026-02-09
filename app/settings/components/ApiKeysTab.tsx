"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useToastContext } from "./ToastProvider";

const PROVIDERS = [
  { id: "openrouter", label: "OpenRouter", placeholder: "sk-or-v1-..." },
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic", label: "Anthropic (Claude)", placeholder: "sk-ant-..." },
  { id: "google", label: "Google (Gemini)", placeholder: "AIza..." },
] as const;

/**
 * Manage user-provided API keys and usage preference.
 */
export function ApiKeysTab() {
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToastContext();

  const userKeys = useQuery(api.apiKeys.getUserKeys, {});
  const useOwnKeyPreference = useQuery(api.apiKeys.getUseOwnKeyPreference);
  const setUseOwnKeyPref = useMutation(api.apiKeys.setUseOwnKeyPreference);

  /**
   * Persist the preference for using user-provided keys.
   */
  const handleToggleUseOwnKey = async (value: boolean) => {
    setLoading(true);
    try {
      await setUseOwnKeyPref({ useOwnKey: value });
      setUseOwnKey(value);
      toast.success(value ? "Using your own API keys enabled" : "Using system API keys");
    } catch (error) {
      console.error("Failed to update preference:", error);
      toast.error("Failed to update preference");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save a new API key for the selected provider.
   */
  const handleSaveKey = async (provider: string) => {
    const keyValue = keyValues[provider];
    if (!keyValue) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/user/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key: keyValue }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save key");
      }
      
      setKeyValues((prev) => ({ ...prev, [provider]: "" }));
      toast.success(`${PROVIDERS.find(p => p.id === provider)?.label || provider} API key saved`);
    } catch (error) {
      console.error("Failed to save key:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save API key";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete a stored API key after confirmation.
   */
  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/user/keys?keyId=${encodeURIComponent(keyId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete API key");
      }
      toast.success("API key deleted");
    } catch (error) {
      console.error("Failed to delete key:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete API key";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Return the active key for a provider, if any.
   */
  const getKeyForProvider = (provider: string) => {
    return userKeys?.find((k: any) => k.provider === provider && k.isActive);
  };

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>API Keys</h2>
      </div>

      <div className="settings-card">
        <div className="field">
          <label className="field-label">Use My Own Keys</label>
          <div className="settings-toggle">
            <input
              type="checkbox"
              id="use-own-keys"
              checked={useOwnKeyPreference ?? false}
              onChange={(e) => handleToggleUseOwnKey(e.target.checked)}
              disabled={loading}
            />
            <label htmlFor="use-own-keys">
              When enabled, your API keys will be used instead of system keys
            </label>
          </div>
          <p className="field-hint">
            Your keys are encrypted and stored securely. You will be charged by the provider directly.
          </p>
        </div>

        <div className="settings-divider" />

        {PROVIDERS.map((provider) => {
          const existingKey = getKeyForProvider(provider.id);

          return (
            <div key={provider.id} className="field">
              <label className="field-label">{provider.label}</label>
              {existingKey ? (
                <div className="settings-key-display">
                  <div className="settings-key-status">
                    <span className="settings-key-status-indicator active" />
                    Active
                    {existingKey.lastUsed && (
                      <span className="settings-key-last-used">
                        Last used: {new Date(existingKey.lastUsed).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="settings-key-actions">
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      onClick={() => handleDeleteKey(existingKey._id)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="settings-key-input">
                  <input
                    type="password"
                    className="field-input"
                    placeholder={provider.placeholder}
                    value={keyValues[provider.id] || ""}
                    onChange={(e) =>
                      setKeyValues((prev) => ({ ...prev, [provider.id]: e.target.value }))
                    }
                    disabled={loading}
                  />
                  <div className="settings-key-input-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      onClick={() => handleSaveKey(provider.id)}
                      disabled={loading || !keyValues[provider.id]}
                    >
                      Add Key
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="settings-divider" />
        <div className="field">
          <p className="field-hint">
            <strong>Security Note:</strong> All API keys are encrypted at rest. Only you can access your keys.
            Keys are never exposed in logs or error messages.
          </p>
        </div>
      </div>
    </section>
  );
}
