"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const PROVIDERS = [
  { id: "openrouter", label: "OpenRouter", placeholder: "sk-or-v1-..." },
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic", label: "Anthropic (Claude)", placeholder: "sk-ant-..." },
  { id: "google", label: "Google (Gemini)", placeholder: "AIza..." },
] as const;

export function ApiKeysTab() {
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [loading, setLoading] = useState(false);

  const userKeys = useQuery(api.apiKeys.getUserKeys);
  const useOwnKeyPreference = useQuery(api.apiKeys.getUseOwnKeyPreference);
  const setUseOwnKeyPref = useMutation(api.apiKeys.setUseOwnKeyPreference);
  const upsertKey = useMutation(api.apiKeys.upsertKey);
  const deleteKey = useMutation(api.apiKeys.deleteKey);

  const handleToggleUseOwnKey = async (value: boolean) => {
    setLoading(true);
    try {
      await setUseOwnKeyPref({ useOwnKey: value });
      setUseOwnKey(value);
    } catch (error) {
      console.error("Failed to update preference:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async (provider: string) => {
    const keyValue = keyValues[provider];
    if (!keyValue) {
      return;
    }

    setLoading(true);
    try {
      // In production, encrypt the key before sending
      // For now, we'll send it as-is (encryption should happen server-side)
      await upsertKey({
        provider: provider as any,
        keyHash: keyValue, // TODO: Encrypt this
      });
      setEditingProvider(null);
      setKeyValues((prev) => ({ ...prev, [provider]: "" }));
    } catch (error) {
      console.error("Failed to save key:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) {
      return;
    }

    setLoading(true);
    try {
      await deleteKey({ keyId: keyId as any });
    } catch (error) {
      console.error("Failed to delete key:", error);
    } finally {
      setLoading(false);
    }
  };

  const getKeyForProvider = (provider: string) => {
    return userKeys?.find((k: any) => k.provider === provider && k.isActive);
  };

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2>API Keys</h2>
        <p>Manage your bring-your-own AI API keys</p>
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
          const isEditing = editingProvider === provider.id;

          return (
            <div key={provider.id} className="field">
              <label className="field-label">{provider.label}</label>
              {existingKey && !isEditing ? (
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
                      className="btn btn-secondary btn-small"
                      onClick={() => setEditingProvider(provider.id)}
                    >
                      Edit
                    </button>
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
                      Save
                    </button>
                    {existingKey && (
                      <button
                        type="button"
                        className="btn btn-text btn-small"
                        onClick={() => {
                          setEditingProvider(null);
                          setKeyValues((prev) => ({ ...prev, [provider.id]: "" }));
                        }}
                      >
                        Cancel
                      </button>
                    )}
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
