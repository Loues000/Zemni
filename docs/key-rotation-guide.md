# Encryption Key Rotation Guide

This guide explains how to rotate the `ENCRYPTION_KEY` environment variable when you need to change it in the future.

## When to Rotate Keys

You should rotate your encryption key if:
- The key has been compromised or exposed
- You're following a security policy that requires periodic key rotation
- You're migrating to a new key management system
- You suspect unauthorized access to encrypted data

## Prerequisites

1. **Database Backup**: Always create a backup of your Convex database before rotating keys
2. **Access**: You need access to:
   - Your Convex database
   - Environment variables (to set new key)
   - The rotation script (`scripts/rotate-encryption-key.ts`)

## Step-by-Step Process

### 1. Generate New Encryption Key

Generate a new 64-character hexadecimal key:

```bash
# Method 1: Node.js (recommended)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Method 2: OpenSSL
openssl rand -hex 32

# Method 3: Python
python -c "import secrets; print(secrets.token_hex(32))"
```

Save the output - you'll need it for the next steps.

### 2. Backup Database

**CRITICAL**: Create a backup of your Convex database before proceeding. If something goes wrong, you'll need this backup to restore.

### 3. Test in Development (Recommended)

If possible, test the rotation process in a development environment first:

1. Set up a development database with test API keys
2. Run the rotation script with test keys
3. Verify all keys can be decrypted with the new key
4. Test that the application works correctly

### 4. Run Dry-Run

Before making actual changes, run the script in dry-run mode to preview what will happen:

```bash
OLD_ENCRYPTION_KEY=<current_key> NEW_ENCRYPTION_KEY=<new_key> npm run rotate-key -- --dry-run
```

This will:
- Validate that the old key can decrypt existing keys
- Show what changes would be made
- **Not modify the database**

### 5. Perform Rotation

Once you've verified the dry-run looks correct, run the actual rotation:

```bash
OLD_ENCRYPTION_KEY=<current_key> NEW_ENCRYPTION_KEY=<new_key> npm run rotate-key
```

The script will:
1. Connect to Convex
2. Fetch all encrypted API keys
3. Validate that the old key can decrypt them
4. Re-encrypt each key with the new key
5. Update keys in the database
6. Verify all keys can be decrypted with the new key

### 6. Update Environment Variables

**IMPORTANT**: After successful rotation, update `ENCRYPTION_KEY` in your environment variables:

- **Development**: Update `.env.local`
- **Production**: Update environment variables in your hosting platform (Vercel, Railway, etc.)

**The application will not work until `ENCRYPTION_KEY` is updated to the new key.**

### 7. Verify Application Works

After updating the environment variable:

1. Restart your application
2. Test that users can:
   - View their API keys (decryption should work)
   - Use their API keys for generation
   - Add new API keys (encryption should work)

### 8. Clean Up Old Key

Once you've verified everything works:
- Remove `OLD_ENCRYPTION_KEY` from your environment
- Securely delete any temporary files containing the old key
- Update your key management system

## Troubleshooting

### Error: "Failed to decrypt key with old encryption key"

**Cause**: The `OLD_ENCRYPTION_KEY` you provided doesn't match the key that was used to encrypt the existing keys.

**Solution**:
- Verify you're using the correct current `ENCRYPTION_KEY` value
- Check if the key was changed recently (you might need an even older key)
- If keys were encrypted with a different key, you'll need to find that key

### Error: "Failed to decrypt key with new key" after rotation

**Cause**: Something went wrong during the rotation process.

**Solution**:
1. **DO NOT** update `ENCRYPTION_KEY` in your environment yet
2. Check the rotation logs to see which keys failed
3. Restore from database backup if necessary
4. Investigate the issue and try again

### Application fails after rotation

**Cause**: `ENCRYPTION_KEY` environment variable wasn't updated, or was updated incorrectly.

**Solution**:
- Verify `ENCRYPTION_KEY` is set to the new key (not the old one)
- Check that the key is exactly 64 hexadecimal characters
- Restart the application after updating the environment variable
- If the issue persists, check application logs for decryption errors

### Some keys can't be decrypted

**Cause**: These keys might have been encrypted with a different key, or data corruption.

**Solution**:
- Check if these are old keys that were encrypted with a previous key
- Users may need to re-enter their API keys
- If data corruption is suspected, restore from backup

## Security Considerations

1. **Never commit keys to git**: Keys should only be in environment variables
2. **Use secure channels**: When sharing keys temporarily (e.g., with team members), use secure channels
3. **Rotate regularly**: Consider rotating keys periodically as part of your security policy
4. **Monitor access**: After rotation, monitor for any unusual activity
5. **Document rotation**: Keep a log of when keys were rotated (without storing the actual keys)

## Rollback Plan

If something goes wrong during rotation:

1. **DO NOT** update `ENCRYPTION_KEY` in your environment
2. Restore database from backup
3. Investigate what went wrong
4. Fix the issue and try again

If you've already updated `ENCRYPTION_KEY` and the application is broken:

1. Revert `ENCRYPTION_KEY` to the old key
2. Restore database from backup
3. Investigate what went wrong
4. Fix the issue and try again

## Script Options

The rotation script supports the following:

- `--dry-run`: Preview changes without modifying the database
- Environment variables:
  - `OLD_ENCRYPTION_KEY`: Current encryption key (required)
  - `NEW_ENCRYPTION_KEY`: New encryption key (required, or use `ENCRYPTION_KEY`)
  - `NEXT_PUBLIC_CONVEX_URL`: Convex URL (required)

## Example Commands

```bash
# Dry-run to preview changes
OLD_ENCRYPTION_KEY=abc123... NEW_ENCRYPTION_KEY=def456... npm run rotate-key -- --dry-run

# Actual rotation
OLD_ENCRYPTION_KEY=abc123... NEW_ENCRYPTION_KEY=def456... npm run rotate-key

# Using ENCRYPTION_KEY for new key
OLD_ENCRYPTION_KEY=abc123... ENCRYPTION_KEY=def456... npm run rotate-key
```

## Need Help?

If you encounter issues:
1. Check the script output for specific error messages
2. Verify all environment variables are set correctly
3. Ensure you have a database backup
4. Review this guide for troubleshooting steps
