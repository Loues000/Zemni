#!/usr/bin/env node
/**
 * Encryption key rotation script
 * Re-encrypts all API keys in the database when ENCRYPTION_KEY is changed
 * 
 * Usage:
 *   OLD_ENCRYPTION_KEY=<old_key> NEW_ENCRYPTION_KEY=<new_key> npm run rotate-key
 *   or
 *   OLD_ENCRYPTION_KEY=<old_key> NEW_ENCRYPTION_KEY=<new_key> tsx scripts/rotate-encryption-key.ts
 * 
 * Options:
 *   --dry-run    Preview changes without updating database
 * 
 * Safety:
 *   - Always backup your database before running
 *   - Test in development environment first
 *   - Verify old key can decrypt existing keys before proceeding
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

/**
 * Derive encryption key from environment variable using scrypt
 */
function deriveKey(envKey: string): Buffer {
  return crypto.scryptSync(envKey, "salt", KEY_LENGTH);
}

/**
 * Decrypt a key using a specific encryption key
 */
function decryptWithKey(encryptedKey: string, encryptionKey: Buffer): string {
  if (!encryptedKey || typeof encryptedKey !== "string") {
    throw new Error("Invalid encrypted key format: key is empty or not a string");
  }

  const parts = encryptedKey.split(":");
  if (parts.length !== 3) {
    throw new Error(
      `Invalid encrypted key format: expected "iv:tag:encrypted" format with 3 parts, got ${parts.length} parts`
    );
  }

  const [ivHex, tagHex, encrypted] = parts;

  if (!/^[0-9a-f]+$/i.test(ivHex) || !/^[0-9a-f]+$/i.test(tagHex) || !/^[0-9a-f]+$/i.test(encrypted)) {
    throw new Error("Invalid encrypted key format: iv, tag, and encrypted data must be hex-encoded");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Encrypt a key using a specific encryption key
 */
function encryptWithKey(key: string, encryptionKey: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);

  let encrypted = cipher.update(key, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/**
 * Get all API keys from Convex
 */
async function getAllApiKeys(convex: ConvexHttpClient): Promise<ApiKey[]> {
  return await convex.query(api.apiKeys.getAllKeysForRotation, {});
}

interface ApiKey {
  _id: string;
  userId: string;
  provider: string;
  keyHash: string;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  console.log("🔐 Encryption Key Rotation Script\n");

  // Check for required environment variables
  const oldKey = process.env.OLD_ENCRYPTION_KEY;
  const newKey = process.env.NEW_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

  if (!oldKey) {
    console.error("❌ Error: OLD_ENCRYPTION_KEY environment variable is required");
    console.error("   Set it to the current ENCRYPTION_KEY value");
    process.exit(1);
  }

  if (!newKey) {
    console.error("❌ Error: NEW_ENCRYPTION_KEY or ENCRYPTION_KEY environment variable is required");
    console.error("   Set it to the new ENCRYPTION_KEY value");
    process.exit(1);
  }

  // Validate key formats
  if (!/^[0-9a-f]{64}$/i.test(oldKey)) {
    console.error("❌ Error: OLD_ENCRYPTION_KEY must be 64 hexadecimal characters");
    process.exit(1);
  }

  if (!/^[0-9a-f]{64}$/i.test(newKey)) {
    console.error("❌ Error: NEW_ENCRYPTION_KEY must be 64 hexadecimal characters");
    process.exit(1);
  }

  if (oldKey === newKey) {
    console.error("❌ Error: Old and new keys are the same. No rotation needed.");
    process.exit(1);
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ Error: NEXT_PUBLIC_CONVEX_URL environment variable is required");
    process.exit(1);
  }

  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  } else {
    console.log("⚠️  WARNING: This will update all API keys in the database");
    console.log("⚠️  Make sure you have a database backup before proceeding!\n");
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    
    // Derive keys
    const oldEncryptionKey = deriveKey(oldKey);
    const newEncryptionKey = deriveKey(newKey);

    console.log("📋 Fetching all API keys from database...");
    
    // Note: This requires implementing getAllKeysForRotation in convex/apiKeys.ts
    // For now, we'll show the structure
    const allKeys: ApiKey[] = await getAllApiKeys(convex);
    
    if (allKeys.length === 0) {
      console.log("ℹ️  No API keys found in database. Nothing to rotate.");
      process.exit(0);
    }

    console.log(`📊 Found ${allKeys.length} API key(s) to rotate\n`);

    // Validate that old key can decrypt existing keys
    console.log("🔍 Validating old encryption key...");
    let validationErrors = 0;
    for (const key of allKeys) {
      try {
        decryptWithKey(key.keyHash, oldEncryptionKey);
      } catch (error) {
        console.error(`❌ Failed to decrypt key ${key._id}: ${error instanceof Error ? error.message : String(error)}`);
        validationErrors++;
      }
    }

    if (validationErrors > 0) {
      console.error(`\n❌ Error: Failed to decrypt ${validationErrors} key(s) with old encryption key`);
      console.error("   Please verify that OLD_ENCRYPTION_KEY is correct");
      process.exit(1);
    }

    console.log("✅ Old encryption key validated successfully\n");

    if (isDryRun) {
      console.log("🔍 DRY RUN - Would re-encrypt the following keys:");
      for (const key of allKeys) {
        const decrypted = decryptWithKey(key.keyHash, oldEncryptionKey);
        const reEncrypted = encryptWithKey(decrypted, newEncryptionKey);
        console.log(`  - Key ${key._id} (${key.provider}): ${key.keyHash.substring(0, 20)}... → ${reEncrypted.substring(0, 20)}...`);
      }
      console.log("\n✅ Dry run completed. No changes made.");
      process.exit(0);
    }

    // Re-encrypt all keys
    console.log("🔄 Re-encrypting API keys...");
    let successCount = 0;
    let errorCount = 0;

    for (const key of allKeys) {
      try {
        // Decrypt with old key
        const decrypted = decryptWithKey(key.keyHash, oldEncryptionKey);
        
        // Encrypt with new key
        const reEncrypted = encryptWithKey(decrypted, newEncryptionKey);
        
        // Update in database
        await convex.mutation(api.apiKeys.updateKeyHash, {
          keyId: key._id as any,
          newKeyHash: reEncrypted,
        });
        
        console.log(`  ✓ Rotated key ${key._id} (${key.provider})`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed to rotate key ${key._id}: ${error instanceof Error ? error.message : String(error)}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Rotation complete:`);
    console.log(`   ✅ Successfully rotated: ${successCount}`);
    if (errorCount > 0) {
      console.log(`   ❌ Failed: ${errorCount}`);
    }

    // Verify all keys can be decrypted with new key
    console.log("\n🔍 Verifying new encryption key...");
    const allKeysAfter = await getAllApiKeys(convex);
    let verifyErrors = 0;
    
    for (const key of allKeysAfter) {
      try {
        decryptWithKey(key.keyHash, newEncryptionKey);
      } catch (error) {
        console.error(`❌ Failed to decrypt key ${key._id} with new key`);
        verifyErrors++;
      }
    }

    if (verifyErrors > 0) {
      console.error(`\n❌ Error: ${verifyErrors} key(s) cannot be decrypted with new encryption key`);
      console.error("   This indicates a problem during rotation. Check logs above.");
      process.exit(1);
    }

    console.log("✅ All keys verified successfully with new encryption key");
    console.log("\n✅ Key rotation completed successfully!");
    console.log("\n⚠️  IMPORTANT: Update ENCRYPTION_KEY in your environment variables to the new key");
    console.log("   The application will not work until ENCRYPTION_KEY is updated");

  } catch (error) {
    console.error("\n❌ Fatal error during key rotation:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
