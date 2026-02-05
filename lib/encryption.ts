/**
 * Encryption/decryption utilities for API keys using AES-256-GCM
 * Provides authenticated encryption with integrity protection
 */

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

/**
 * Retrieve the 32-byte encryption key used for AES-256-GCM operations.
 *
 * If the ENCRYPTION_KEY environment variable is set, derives a 32-byte key from it using scrypt.
 * If ENCRYPTION_KEY is not set and NODE_ENV is "production", throws an error; in non-production, logs a warning and returns a 32-byte key derived from a fixed development fallback.
 *
 * @returns A 32-byte Buffer suitable for use as an AES-256-GCM key.
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
 * Encrypts a plaintext API key using AES-256-GCM.
 *
 * @param key - The plaintext API key to encrypt
 * @returns A hex-encoded string in the format `iv:tag:encrypted`, where `iv` is the initialization vector, `tag` is the authentication tag, and `encrypted` is the ciphertext
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
 * Decrypts an AES-256-GCM encrypted value encoded as `iv:tag:encrypted` (hex).
 *
 * @param encryptedKey - The encrypted input formatted as three hex-encoded parts separated by `:`
 *   — initialization vector, authentication tag, and ciphertext.
 * @returns The decrypted plaintext string.
 * @throws If `encryptedKey` is empty, not a string, does not contain exactly three `:`-separated parts,
 *   contains non-hex characters, or if the IV length is incorrect.
 * @throws If decryption fails (for example due to corrupted data or an encryption key mismatch).
 */
export function decryptKey(encryptedKey: string): string {
  const encryptionKey = getEncryptionKey();
  
  // Validate input
  if (!encryptedKey || typeof encryptedKey !== "string") {
    throw new Error("Invalid encrypted key format: key is empty or not a string");
  }
  
  // Split the stored format: iv:tag:encrypted
  const parts = encryptedKey.split(":");
  if (parts.length !== 3) {
    throw new Error(
      `Invalid encrypted key format: expected "iv:tag:encrypted" format with 3 parts, got ${parts.length} parts. ` +
      `This may indicate corrupted data or a key that was stored in an old format. Please re-enter your API key.`
    );
  }

  const [ivHex, tagHex, encrypted] = parts;

  // Validate hex format
  if (!/^[0-9a-f]+$/i.test(ivHex) || !/^[0-9a-f]+$/i.test(tagHex) || !/^[0-9a-f]+$/i.test(encrypted)) {
    throw new Error(
      "Invalid encrypted key format: iv, tag, and encrypted data must be hex-encoded. " +
      "This may indicate corrupted data. Please re-enter your API key."
    );
  }

  try {
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    // Validate IV and tag lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid encrypted key format")) {
      throw error;
    }
    throw new Error(
      `Failed to decrypt key: ${error instanceof Error ? error.message : String(error)}. ` +
      `This may indicate corrupted data or an encryption key mismatch. Please re-enter your API key.`
    );
  }
}

/**
 * Produces a non-cryptographically-secure one-way hash of a string for simple verification or indexing.
 *
 * @param key - Input string to hash
 * @deprecated This function is unused and is not suitable for security-sensitive purposes; replace with a SHA-256-based implementation if needed.
 * @returns A base-36 string representation of a 32-bit integer hash
 */
export function hashKey(key: string): string {
  // Simple hash algorithm - NOT cryptographically secure
  // TODO: If this function is needed, replace with SHA-256 using crypto.createHash('sha256')
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}