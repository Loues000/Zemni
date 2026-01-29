/**
 * Simple encryption/decryption utilities for API keys
 * In production, use a more robust encryption library like crypto-js or node:crypto
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-key-change-in-production";

/**
 * Encrypt a string (simple XOR for now - replace with proper encryption in production)
 * WARNING: This is a placeholder. Use proper encryption like AES-256 in production.
 */
export function encryptKey(key: string): string {
  // In production, use proper encryption:
  // import crypto from "node:crypto";
  // const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  // return cipher.update(key, "utf8", "hex") + cipher.final("hex");

  // Placeholder: simple base64 encoding (NOT secure - replace in production)
  return Buffer.from(key).toString("base64");
}

/**
 * Decrypt a string
 * WARNING: This is a placeholder. Use proper decryption in production.
 */
export function decryptKey(encryptedKey: string): string {
  // In production, use proper decryption:
  // import crypto from "node:crypto";
  // const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv);
  // return decipher.update(encryptedKey, "hex", "utf8") + decipher.final("utf8");

  // Placeholder: simple base64 decoding (NOT secure - replace in production)
  return Buffer.from(encryptedKey, "base64").toString("utf8");
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
