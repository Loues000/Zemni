import type { OutputEntry, OutputKind, UsageStats, Flashcard, QuizQuestion } from "@/types";

export interface CacheKey {
  docHash: string;
  mode: OutputKind;
  modelId: string;
  params: {
    structureHints?: string;
    flashcardsDensity?: number;
    questionsCount?: number;
  };
}

export interface CachedResult {
  output: OutputEntry;
  timestamp: number;
  cacheKey: CacheKey;
}

const CACHE_STORAGE_KEY = "summary-maker-cache-v1";
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CACHE_MAX_ENTRIES = 100; // Limit cache size

/**
 * Creates a hash from document content for caching
 */
export const createDocHash = (extractedText: string, fileName: string): string => {
  // Use a more robust hash that includes the full content
  const content = `${fileName}:${extractedText}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `doc-${Math.abs(hash).toString(36)}`;
};

/**
 * Creates a cache key from generation parameters
 */
export const createCacheKey = (
  docHash: string,
  mode: OutputKind,
  modelId: string,
  params: CacheKey["params"]
): string => {
  const paramsStr = JSON.stringify(params);
  return `${docHash}:${mode}:${modelId}:${paramsStr}`;
};

/**
 * Loads cache from localStorage
 */
const loadCache = (): Map<string, CachedResult> => {
  if (typeof window === "undefined") return new Map();
  
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return new Map();
    
    const parsed = JSON.parse(raw) as Record<string, CachedResult>;
    const cache = new Map<string, CachedResult>();
    const now = Date.now();
    
    // Filter out expired entries
    for (const [key, value] of Object.entries(parsed)) {
      if (now - value.timestamp < CACHE_MAX_AGE_MS) {
        cache.set(key, value);
      }
    }
    
    return cache;
  } catch (e) {
    console.warn("Failed to load cache:", e);
    return new Map();
  }
};

/**
 * Saves cache to localStorage
 */
const saveCache = (cache: Map<string, CachedResult>): void => {
  if (typeof window === "undefined") return;
  
  try {
    // Limit cache size by removing oldest entries
    const entries = Array.from(cache.entries());
    if (entries.length > CACHE_MAX_ENTRIES) {
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toKeep = entries.slice(-CACHE_MAX_ENTRIES);
      cache.clear();
      for (const [key, value] of toKeep) {
        cache.set(key, value);
      }
    }
    
    const obj = Object.fromEntries(cache);
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn("Failed to save cache:", e);
  }
};

/**
 * Gets cached result if available
 */
export const getCachedResult = (cacheKey: string): CachedResult | null => {
  const cache = loadCache();
  const cached = cache.get(cacheKey);
  
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_MAX_AGE_MS) {
    cache.delete(cacheKey);
    saveCache(cache);
    return null;
  }
  
  return cached;
};

/**
 * Stores result in cache
 */
export const setCachedResult = (
  cacheKey: string,
  output: OutputEntry,
  key: CacheKey
): void => {
  const cache = loadCache();
  
  cache.set(cacheKey, {
    output: {
      ...output,
      // Remove transient fields
      isGenerating: false,
      error: undefined
    },
    timestamp: Date.now(),
    cacheKey: key
  });
  
  saveCache(cache);
};

/**
 * Clears expired cache entries
 */
export const clearExpiredCache = (): void => {
  const cache = loadCache();
  const now = Date.now();
  let changed = false;
  
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp >= CACHE_MAX_AGE_MS) {
      cache.delete(key);
      changed = true;
    }
  }
  
  if (changed) {
    saveCache(cache);
  }
};

/**
 * Clears all cache
 */
export const clearAllCache = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear cache:", e);
  }
};
