/**
 * Encryption/decryption utilities for API keys using AES-256-GCM
 * Provides authenticated encryption with integrity protection
 */

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment variable
 * Derives a 32-byte key using scrypt for key stretching
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (!envKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY environment variable is required in production");
    }
    // Development fallback (warn but allow)
    console.warn("WARNING: ENCRYPTION_KEY not set, using insecure default. Set ENCRYPTION_KEY in production!");
    return crypto.scryptSync("default-key-change-in-production", "salt", KEY_LENGTH);
  }
  
  // Derive 32-byte key from environment variable using scrypt
  return crypto.scryptSync(envKey, "salt", KEY_LENGTH);
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns format: iv:tag:encrypted (all hex-encoded)
 */
export function encryptKey(key: string): string {
  const encryptionKey = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
  
  let encrypted = cipher.update(key, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  
  // Return: iv:tag:encrypted (all hex-encoded)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a string using AES-256-GCM
 * Expects format: iv:tag:encrypted (all hex-encoded)
 */
export function decryptKey(encryptedKey: string): string {
  const encryptionKey = getEncryptionKey();
  
  // Split the stored format: iv:tag:encrypted
  const parts = encryptedKey.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted key format");
  }
  
  const [ivHex, tagHex, encrypted] = parts;
  
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Hash a key for storage (one-way, for verification purposes)
 */
export function hashKey(key: string): string {
  // In production, use proper hashing like bcrypt or SHA-256
  // For now, return a simple hash
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}
