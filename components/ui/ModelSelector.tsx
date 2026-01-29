"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { Model } from "@/types";
import { IconChevron, IconLock } from "./Icons";
import { isModelAvailable } from "@/lib/model-utils";
import Link from "next/link";

interface ModelSelectorProps {
  models: Model[];
  selectedModel: string;
  onModelChange: (value: string) => void;
  userTier?: string | null;
  id?: string;
  className?: string;
}

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  plus: "Plus",
  pro: "Pro"
};

const TIER_ORDER = ["free", "basic", "plus", "pro"];

export function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  userTier = "free",
  id,
  className = ""
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Group models by tier
  const groupedModels = useMemo(() => {
    const groups: Record<string, Model[]> = {};

    models.forEach(model => {
      const tier = model.subscriptionTier || "other";
      if (!groups[tier]) {
        groups[tier] = [];
      }
      groups[tier].push(model);
    });

    // Sort tiers according to order, then alphabetically within each tier
    const sortedGroups: Record<string, Model[]> = {};
    TIER_ORDER.forEach(tier => {
      if (groups[tier]) {
        sortedGroups[tier] = [...groups[tier]].sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        );
      }
    });

    // Add any remaining tiers not in the order
    Object.keys(groups).forEach(tier => {
      if (!TIER_ORDER.includes(tier)) {
        sortedGroups[tier] = [...groups[tier]].sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        );
      }
    });

    return sortedGroups;
  }, [models]);

  const selectedModelData = models.find(m => m.id === selectedModel);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || !listRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = listRef.current?.querySelectorAll<HTMLElement>(".model-option");
      if (!items || items.length === 0) return;

      const currentIndex = Array.from(items).findIndex(item =>
        item.getAttribute("aria-selected") === "true"
      );

      let newIndex = currentIndex;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          break;
        case "ArrowUp":
          e.preventDefault();
          newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          break;
        case "Home":
          e.preventDefault();
          newIndex = 0;
          break;
        case "End":
          e.preventDefault();
          newIndex = items.length - 1;
          break;
        case "Enter":
        case " ":
          if (currentIndex >= 0) {
            e.preventDefault();
            const modelId = items[currentIndex].getAttribute("data-model-id");
            if (modelId) {
              onModelChange(modelId);
              setIsOpen(false);
            }
          }
          return;
      }

      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < items.length) {
        items[newIndex].focus();
        items[newIndex].scrollIntoView({ block: "nearest" });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onModelChange]);

  const handleSelect = (modelId: string, isAvailable: boolean) => {
    if (!isAvailable) return;
    onModelChange(modelId);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className={`model-selector${className ? ` ${className}` : ""}`} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        className="model-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select model"
      >
        <span className="model-selector-button-text">
          {selectedModelData?.displayName || "Select a model"}
        </span>
        {selectedModelData?.subscriptionTier && (
          <span className={`tier-badge tier-badge-${selectedModelData.subscriptionTier}`}>
            {TIER_LABELS[selectedModelData.subscriptionTier] || selectedModelData.subscriptionTier}
          </span>
        )}
        <IconChevron />
      </button>

      {isOpen && (
        <>
          <div className="model-selector-backdrop" onClick={() => setIsOpen(false)} />
          <div className="model-selector-dropdown custom-scrollbar" role="listbox" ref={listRef}>
            {Object.entries(groupedModels).map(([tier, tierModels]) => {
              const isTierAvailable = isModelAvailable(tier, userTier);
              return (
                <div key={tier} className={`model-selector-group${!isTierAvailable ? " tier-locked" : ""}`}>
                  <div className="model-selector-group-header">
                    <span className="model-selector-group-label">
                      {!isTierAvailable && <IconLock />}
                      {TIER_LABELS[tier] || tier.charAt(0).toUpperCase() + tier.slice(1)}
                      {!isTierAvailable && <span className="unlock-label">Unlock</span>}
                    </span>
                  </div>
                  {tierModels.map((model) => {
                    const isSelected = model.id === selectedModel;
                    const isAvailable = isModelAvailable(model.subscriptionTier, userTier);

                    return (
                      <button
                        key={model.id}
                        type="button"
                        className={`model-option${isSelected ? " selected" : ""}${!isAvailable ? " locked" : ""}`}
                        data-model-id={model.id}
                        onClick={() => handleSelect(model.id, isAvailable)}
                        aria-selected={isSelected}
                        aria-disabled={!isAvailable}
                        role="option"
                      >
                        <div className="model-option-main">
                          <span className="model-option-name">{model.displayName}</span>
                          {!isAvailable && (model.subscriptionTier === "pro" || model.subscriptionTier === "plus") && (
                            <span className="premium-sparkle" title="Premium Performance">✨</span>
                          )}
                        </div>
                        <div className="model-option-meta">
                          {!isAvailable ? (
                            <span className="upgrade-tag">Pro</span>
                          ) : (
                            model.subscriptionTier && model.subscriptionTier !== "free" && (
                              <span className={`tier-badge tier-badge-${model.subscriptionTier}`}>
                                {TIER_LABELS[model.subscriptionTier] || model.subscriptionTier}
                              </span>
                            )
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {userTier !== "pro" && (
              <div className="model-selector-upgrade-cta">
                <Link href="/settings" onClick={() => setIsOpen(false)}>
                  Unlock premium models in Settings →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
