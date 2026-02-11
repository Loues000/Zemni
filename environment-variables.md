# Environment Variables Guide

This document explains all environment variables used in Zemni and how to configure them.

## Quick Setup

1. Copy `.env.example` to `.env.local`
2. Fill in the required variables (see below)
3. Restart your development server

## Required Variables

### Core Services

#### `NEXT_PUBLIC_CONVEX_URL`
- **Required**: Yes
- **Description**: Your Convex deployment URL
- **How to get**: 
  1. Go to https://dashboard.convex.dev
  2. Create a new project or select an existing one
  3. Copy the deployment URL (format: `https://your-deployment.convex.cloud`)
- **Example**: `https://happy-animal-123.convex.cloud`

#### `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- **Required**: Yes (for authentication features)
- **Description**: Clerk publishable key for user authentication
- **How to get**:
  1. Go to https://dashboard.clerk.com
  2. Create a new application or select an existing one
  3. Go to "API Keys" section
  4. Copy the "Publishable key" (starts with `pk_`)
- **Example**: `pk_test_abc123...`

#### `CLERK_SECRET_KEY`
- **Required**: Yes (for server-side authentication)
- **Description**: Clerk secret key for server-side operations
- **How to get**:
  1. Go to https://dashboard.clerk.com
  2. Select your application
  3. Go to "API Keys" section
  4. Copy the "Secret key" (starts with `sk_`)
- **Example**: `sk_test_abc123...` (test) or `sk_live_abc123...` (production)
- **Note**: Never expose this key to the browser - it's server-side only

#### `CLERK_JWT_ISSUER_DOMAIN`
- **Required**: Yes (for Convex auth integration)
- **Description**: Clerk JWT issuer domain for Convex authentication
- **How to get**:
  1. In your Clerk dashboard, go to "JWT Templates"
  2. The issuer domain is shown in the format: `https://your-app.clerk.accounts.dev`
  3. Or check your Clerk application settings
- **Example**: `https://your-app.clerk.accounts.dev`

#### `OPENROUTER_API_KEY`
- **Required**: Yes
- **Description**: Default OpenRouter API key for AI model access
- **How to get**:
  1. Go to https://openrouter.ai
  2. Sign up or log in
  3. Go to "Keys" section
  4. Create a new API key (format: `sk-or-v1-...`)
- **Note**: Users can also add their own API keys in settings
- **Example**: `sk-or-v1-abc123...`

## Optional Variables

### Subscription System (Polar)

These are only needed if you want to enable subscription-based model access.

#### `POLAR_ACCESS_TOKEN`
- **Required**: Only if using subscriptions
- **Description**: Polar access token for server-side operations
- **How to get**: Create an access token in the Polar dashboard (Organization Settings -> Access Tokens)
- **Example**: `polar_pat_...`

#### `POLAR_WEBHOOK_SECRET`
- **Required**: Only if using subscriptions
- **Description**: Polar webhook signing secret
- **How to get**:
  1. In the Polar dashboard, go to Webhooks
  2. Create a webhook endpoint pointing to: `https://your-domain.com/api/polar/webhook`
  3. Copy the "Signing secret"

#### `POLAR_PRODUCT_ID_PLUS`
- **Required**: Only if using subscriptions
- **Description**: Polar product ID for Plus tier subscription
- **Note**: Polar product IDs are UUIDs (they may not start with `product_`).

#### `POLAR_PRODUCT_ID_PRO`
- **Required**: Only if using subscriptions
- **Description**: Polar product ID for Pro tier subscription
- **Note**: Polar product IDs are UUIDs (they may not start with `product_`).

#### `POLAR_SERVER`
- **Required**: No
- **Description**: Set to `sandbox` when using Polar Sandbox; omit for production

### Notion Integration

#### `NOTION_TOKEN`
- **Required**: No (users can configure their own)
- **Description**: Default Notion API token for exports
- **How to get**: https://www.notion.so/my-integrations
- **Note**: Users can override this with their own token in settings

#### `NOTION_SUBJECTS_DATABASE_ID`
- **Required**: No (only if using default Notion integration)
- **Description**: Notion database ID for subject organization
- **How to get**: Extract from Notion database URL (the long string before `?`)

### Security

#### `ENCRYPTION_KEY`
- **Required**: **YES in production** (will throw error if missing)
- **Description**: Key for encrypting user API keys and Notion tokens using AES-256-GCM
- **Security**: **CRITICAL** - Must be a secure random string (64 hex characters = 32 bytes)
- **How to generate**: 
  ```bash
  # Method 1: Using Node.js (recommended)
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  
  # Method 2: Using OpenSSL
  openssl rand -hex 32
  
  # Method 3: Using Python
  python -c "import secrets; print(secrets.token_hex(32))"
  
  # Method 4: Online (use only if you trust the service)
  # Visit: https://www.random.org/strings/?num=1&len=64&digits=on&upperalpha=on&loweralpha=on&unique=on&format=plain&rnd=new
  ```
- **Format**: 64 hexadecimal characters (0-9, a-f)
- **Example**: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`
- **Storage**: Store securely in your hosting platform's environment variables (Vercel, Railway, etc.)
- **Warning**: 
  - ❌ **In production**: Will throw error if not set (prevents insecure default)
  - ⚠️ **In development**: Uses insecure default with warning (for convenience)
  - 🔒 **Never commit** this key to git or share it publicly
  - 🔄 **Rotate** if you suspect it's been compromised

### Error Tracking (Sentry)

#### `NEXT_PUBLIC_SENTRY_DSN`
- **Required**: No (error tracking disabled if not set)
- **Description**: Sentry DSN for client-side (browser) error tracking
- **Why configure Sentry?**
  - 🔍 **Automatic error tracking**: Captures unhandled exceptions automatically
  - 📧 **Alerts**: Get notified when critical errors occur in production
  - 🐛 **Debugging**: See full stack traces, user context, and breadcrumbs
  - 📊 **Performance monitoring**: Track slow API calls and page loads
  - 👥 **User context**: Associate errors with specific users (anonymized)
- **How to get**:
  1. Go to https://sentry.io and sign up (free tier available)
  2. Create a new project (select "Next.js")
  3. Go to Settings → Client Keys (DSN)
  4. Copy the DSN (format: `https://xxx@xxx.ingest.sentry.io/xxx`)
- **Example**: `https://abc123@o123456.ingest.sentry.io/1234567`
- **Note**: This is safe to expose to the browser (it's a public key)

#### `SENTRY_DSN`
- **Required**: No (server-side error tracking disabled if not set)
- **Description**: Sentry DSN for server-side (API routes) error tracking
- **How to get**: Same as `NEXT_PUBLIC_SENTRY_DSN` (can use the same DSN or create separate project)
- **Example**: `https://abc123@o123456.ingest.sentry.io/1234567`
- **Note**: This is server-side only (not exposed to browser)

**Sentry Configuration Details:**
- ✅ Already configured in `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- ✅ Automatically sanitizes sensitive data (no API keys, cookies, or PII sent)
- ✅ Performance monitoring enabled (10% sample rate in production)
- ✅ Session replay enabled for debugging (10% of sessions, 100% on errors)
- ✅ User context automatically set via `UserSync.tsx` component
- ⚠️ Falls back to console logging if DSN not configured (no errors thrown)

### Configuration

#### `NEXT_PUBLIC_SITE_URL`
- **Required**: No (defaults to `http://localhost:3420`)
- **Description**: Your site's public URL
- **Used for**: Polar redirects, OpenRouter headers
- **Example**: `https://your-domain.com` (production) or `http://localhost:3420` (development)

#### `OPENROUTER_SITE_URL`
- **Required**: No (defaults to `NEXT_PUBLIC_SITE_URL` or `http://localhost:3420`)
- **Description**: URL sent to OpenRouter in request headers
- **Purpose**: Helps OpenRouter track usage

#### `OPENROUTER_APP_NAME`
- **Required**: No (defaults to "Summary Maker")
- **Description**: App name sent to OpenRouter in request headers

#### `NEXT_PUBLIC_ENABLE_SUBSCRIPTION_TIERS`
- **Required**: No (defaults to `false`)
- **Description**: Enable subscription-based model filtering
- **Values**: `"true"` or `"false"` (string)
- **Behavior**:
  - `false` or unset: All models available to all users
  - `true`: Models filtered by user's subscription tier
- **Note**: Requires Polar configuration to be useful

#### `NEXT_PUBLIC_ENABLE_BILLING`
- **Required**: No (defaults to `false`)
- **Description**: Enable upgrade UI and checkout flow
- **Values**: `"true"` or `"false"` (string)
- **Behavior**:
  - `false` or unset: Upgrade CTAs hidden, checkout disabled (coming soon)
  - `true`: Upgrade CTAs shown and checkout enabled

## Environment-Specific Files

Next.js loads environment variables in this order (later files override earlier):

1. `.env` (not recommended, use `.env.local` instead)
2. `.env.local` (local overrides, **gitignored**)
3. `.env.development` / `.env.production` (environment-specific)
4. `.env.development.local` / `.env.production.local` (local overrides)

**Best Practice**: Use `.env.local` for all your secrets (it's gitignored).

## Variable Naming

- `NEXT_PUBLIC_*`: Exposed to the browser (safe for client-side code)
- No prefix: Server-side only (never exposed to browser)

## Security Notes

1. **Never commit `.env.local`** - It's in `.gitignore` for a reason
2. **Use different keys for development and production**
3. **Rotate keys regularly**, especially if exposed
4. **Set `ENCRYPTION_KEY`** in production - **REQUIRED** (will throw error if missing)
5. **Use production Polar access tokens** only in production
6. **Store secrets securely** - Use your hosting platform's environment variable system (Vercel, Railway, etc.)
7. **Never log or expose** environment variables in error messages or client-side code

## Troubleshooting

### "Missing OpenRouter key"
- Check that `OPENROUTER_API_KEY` is set in `.env.local`
- Restart your development server after adding variables

### "Clerk publishable key not found"
- Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set
- Check that it starts with `pk_` (not `sk_`)

### "Convex URL not found"
- Verify `NEXT_PUBLIC_CONVEX_URL` is set correctly
- Make sure you've run `npx convex dev` to create a deployment

### Subscription features not working
- Check that all Polar variables are set (`POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, product IDs)
- Verify `NEXT_PUBLIC_ENABLE_SUBSCRIPTION_TIERS=true`
- Ensure webhook is configured in Polar dashboard

## Model Configuration

Models are configured in `config/openrouter-models.json` (or `.example.json`). Each model can have a `subscription_tier` field:
- `"free"`: Available to everyone (including non-logged-in users)
- `"basic"`: Requires Basic tier or higher (automatically awarded to all logged-in users)
- `"plus"`: Requires Plus tier or higher (paid tier via Polar)
- `"pro"`: Requires Pro tier (paid tier via Polar)

See `config/openrouter-models.example.json` for the format.

## How Subscription Tiers Work

The subscription tier system controls which AI models users can access:

1. **Tier Hierarchy**: 
   - **Free**: Non-logged-in users (null userTier) - can only access "free" tier models
   - **Basic**: Automatically awarded to all logged-in users - can access "free" and "basic" tier models
   - **Plus**: Paid tier via Polar - can access "free", "basic", and "plus" tier models
   - **Pro**: Paid tier via Polar - can access all models
   - Each tier includes access to lower tiers
2. **Model Assignment**: Each model in `config/openrouter-models.json` has a `subscription_tier` field
3. **Access Control**: 
   - Server-side: API routes check `checkModelAvailability()` before generation
   - Client-side: Model selector filters unavailable models
4. **User Tiers**: Stored in Convex `users` table
   - New users are created with "basic" tier automatically when they login
   - "Plus" and "Pro" tiers are updated via Polar webhooks
   - "Basic" tier is not managed via Polar (it's automatically awarded)
5. **Default**: 
   - Non-logged-in users: "free" tier (null userTier)
   - Logged-in users: "basic" tier (automatically awarded)

**Key Files**:
- `lib/models.ts` - Model loading and tier checking logic
- `lib/model-utils.ts` - Client-side tier availability checks
- `lib/api-helpers.ts` - Server-side tier checks for API routes
- `convex/users.ts` - User tier storage and updates
- `app/api/polar/webhook/route.ts` - Updates tiers when subscriptions change

**To disable**: Set `NEXT_PUBLIC_ENABLE_SUBSCRIPTION_TIERS=false` (or omit it) - all models become available to everyone.

