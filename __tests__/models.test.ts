import { describe, it, expect } from "vitest";
import { isModelAvailable } from "@/lib/models";

describe("isModelAvailable", () => {
  describe("Model without tier", () => {
    it("should be available to all users", () => {
      expect(isModelAvailable({}, null)).toBe(true);
      expect(isModelAvailable({}, "free")).toBe(true);
      expect(isModelAvailable({}, "basic")).toBe(true);
      expect(isModelAvailable({}, "plus")).toBe(true);
      expect(isModelAvailable({}, "pro")).toBe(true);
    });
  });

  describe("Free tier models", () => {
    const freeModel = { subscriptionTier: "free" };

    it("should be available to all users", () => {
      expect(isModelAvailable(freeModel, null)).toBe(true);
      expect(isModelAvailable(freeModel, "free")).toBe(true);
      expect(isModelAvailable(freeModel, "basic")).toBe(true);
      expect(isModelAvailable(freeModel, "plus")).toBe(true);
      expect(isModelAvailable(freeModel, "pro")).toBe(true);
    });
  });

  describe("Basic tier models", () => {
    const basicModel = { subscriptionTier: "basic" };

    it("should not be available to non-logged-in users", () => {
      expect(isModelAvailable(basicModel, null)).toBe(false);
    });

    it("should not be available to free tier users", () => {
      expect(isModelAvailable(basicModel, "free")).toBe(false);
    });

    it("should be available to basic tier and above", () => {
      expect(isModelAvailable(basicModel, "basic")).toBe(true);
      expect(isModelAvailable(basicModel, "plus")).toBe(true);
      expect(isModelAvailable(basicModel, "pro")).toBe(true);
    });
  });

  describe("Plus tier models", () => {
    const plusModel = { subscriptionTier: "plus" };

    it("should not be available to non-logged-in, free, or basic users", () => {
      expect(isModelAvailable(plusModel, null)).toBe(false);
      expect(isModelAvailable(plusModel, "free")).toBe(false);
      expect(isModelAvailable(plusModel, "basic")).toBe(false);
    });

    it("should be available to plus tier and above", () => {
      expect(isModelAvailable(plusModel, "plus")).toBe(true);
      expect(isModelAvailable(plusModel, "pro")).toBe(true);
    });
  });

  describe("Pro tier models", () => {
    const proModel = { subscriptionTier: "pro" };

    it("should only be available to pro tier users", () => {
      expect(isModelAvailable(proModel, null)).toBe(false);
      expect(isModelAvailable(proModel, "free")).toBe(false);
      expect(isModelAvailable(proModel, "basic")).toBe(false);
      expect(isModelAvailable(proModel, "plus")).toBe(false);
      expect(isModelAvailable(proModel, "pro")).toBe(true);
    });
  });

  describe("Tier hierarchy", () => {
    it("should respect tier hierarchy - higher tiers include lower tiers", () => {
      const freeModel = { subscriptionTier: "free" };
      const basicModel = { subscriptionTier: "basic" };
      const plusModel = { subscriptionTier: "plus" };
      const proModel = { subscriptionTier: "pro" };

      // Pro tier should have access to all models
      expect(isModelAvailable(freeModel, "pro")).toBe(true);
      expect(isModelAvailable(basicModel, "pro")).toBe(true);
      expect(isModelAvailable(plusModel, "pro")).toBe(true);
      expect(isModelAvailable(proModel, "pro")).toBe(true);

      // Plus tier should have access to free, basic, plus
      expect(isModelAvailable(freeModel, "plus")).toBe(true);
      expect(isModelAvailable(basicModel, "plus")).toBe(true);
      expect(isModelAvailable(plusModel, "plus")).toBe(true);
      expect(isModelAvailable(proModel, "plus")).toBe(false);

      // Basic tier should have access to free, basic
      expect(isModelAvailable(freeModel, "basic")).toBe(true);
      expect(isModelAvailable(basicModel, "basic")).toBe(true);
      expect(isModelAvailable(plusModel, "basic")).toBe(false);
      expect(isModelAvailable(proModel, "basic")).toBe(false);
    });
  });
});
