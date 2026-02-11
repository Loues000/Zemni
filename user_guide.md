# User Guide: Setting Up Convex, Clerk, and Stripe

This guide will help you set up the authentication, database, and payment systems for the Summary Maker application.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Accounts for:
  - [Convex](https://convex.dev) (free tier available)
  - [Clerk](https://clerk.com) (free tier available)
  - [Stripe](https://stripe.com) (free to start, pay-as-you-go)

## Step 1: Convex Setup

1. **Create a Convex account**
   - Go to https://convex.dev
   - Sign up for a free account
   - Create a new project

2. **Install Convex CLI and initialize**
   ```bash
   npm install -g convex
   npx convex dev
   ```
   This will:
   - Create a `convex/` folder in your project
   - Generate authentication tokens
   - Set up the development environment

3. **Get your Convex URL**
   - After running `npx convex dev`, you'll see a URL like `https://your-project.convex.cloud`
   - Copy this URL

4. **Set up environment variables**
   Add to `.env.local`:
   ```env
   NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
   ```

5. **Configure Clerk JWT in Convex**
   - In your Convex dashboard, go to Settings → Environment Variables
   - Add: `CLERK_JWT_ISSUER_DOMAIN` (you'll get this from Clerk in the next step)

## Step 2: Clerk Setup

1. **Create a Clerk account**
   - Go to https://clerk.com
   - Sign up for a free account
   - Create a new application

2. **Get your Clerk keys**
   - In Clerk Dashboard → API Keys
   - Copy:
     - Publishable Key
     - Secret Key

3. **Set up JWT Template for Convex**
   - In Clerk Dashboard → JWT Templates
   - Create a new template named "convex"
   - Set the token lifetime (e.g., 1 hour)
   - Copy the "Issuer" URL (this is your `CLERK_JWT_ISSUER_DOMAIN`)

4. **Add environment variables**
   Add to `.env.local`:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   CLERK_JWT_ISSUER_DOMAIN=https://your-app.clerk.accounts.dev
   ```

5. **Update Convex with Clerk JWT domain**
   - In Convex dashboard → Settings → Environment Variables
   - Set `CLERK_JWT_ISSUER_DOMAIN` to the value from step 3

## Step 3: Stripe Setup

1. **Create a Stripe account**
   - Go to https://stripe.com
   - Sign up and complete account setup
   - Switch to test mode for development

2. **Get your Stripe keys**
   - In Stripe Dashboard → Developers → API keys
   - Copy:
     - Publishable key (starts with `pk_test_` or `pk_live_`)
     - Secret key (starts with `sk_test_` or `sk_live_`)

3. **Create subscription products**
   - In Stripe Dashboard → Products
   - Create three products:
     - **Basic** tier
     - **Plus** tier
     - **Pro** tier
   - For each product, create a recurring price (monthly or yearly)
   - Copy the Price IDs (starts with `price_`)

4. **Install Stripe CLI (for local webhook testing)**
   
   The Stripe CLI allows you to test webhooks locally during development. Choose your installation method:

   **Windows (Scoop):**
   ```bash
   scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
   scoop install stripe
   ```

   **Windows (Manual):**
   1. Download the latest `stripe_X.X.X_windows_x86_64.zip` from [GitHub Releases](https://github.com/stripe/stripe-cli/releases/latest)
   2. Extract the zip file
   3. Add the path to `stripe.exe` to your `Path` environment variable

   **macOS (Homebrew):**
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

   **macOS (Manual):**
   1. Download the latest tar.gz for your CPU architecture from [GitHub Releases](https://github.com/stripe/stripe-cli/releases/latest)
   2. Extract: `tar -xvf stripe_[XXX]_mac-os_[ARCH_TYPE].tar.gz`
   3. Optionally move to `/usr/local/bin` for global access

   **Linux (apt - Debian/Ubuntu):**
   ```bash
   # Add GPG key
   curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
   
   # Add repository
   echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
   
   # Install
   sudo apt update
   sudo apt install stripe
   ```

   **Linux (Manual):**
   1. Download the latest tar.gz from [GitHub Releases](https://github.com/stripe/stripe-cli/releases/latest)
   2. Extract: `tar -xvf stripe_X.X.X_linux_x86_64.tar.gz`
   3. Move `./stripe` to your PATH

   **Docker:**
   ```bash
   docker run --rm -it stripe/stripe-cli:latest
   ```

5. **Authenticate Stripe CLI**
   
   After installation, authenticate the CLI:
   ```bash
   stripe login
   ```
   
   Press Enter to open the browser and complete authentication. You'll see a pairing code like:
   ```
   Your pairing code is: enjoy-enough-outwit-win
   Press Enter to open the browser...
   ```
   
   Alternatively, use interactive mode with an API key:
   ```bash
   stripe login --interactive
   ```
   
   Or use an API key directly:
   ```bash
   stripe login --api-key sk_test_...
   ```

6. **Set up webhook**
   
   **For production:**
   - In Stripe Dashboard → Developers → Webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://your-domain.com/api/stripe/webhook`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy the webhook signing secret (starts with `whsec_`)

   **For local development:**
   - Run the Stripe CLI to forward webhooks to your local server:
     ```bash
     stripe listen --forward-to localhost:3420/api/stripe/webhook
     ```
   - This will output a webhook signing secret (starts with `whsec_`)
   - Use this secret in your `.env.local` for local testing

7. **Add environment variables**
   Add to `.env.local`:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...  # Use the secret from Stripe CLI for local dev
   STRIPE_PRICE_ID_BASIC=price_...
   STRIPE_PRICE_ID_PLUS=price_...
   STRIPE_PRICE_ID_PRO=price_...
   ```

## Step 4: Convex Project Configuration

**Important:** If you encounter an error like `InvalidDeploymentName: Couldn't parse deployment name`, follow these steps:

1. **Create a project in Convex Dashboard first**
   - Go to https://dashboard.convex.dev
   - Create a new project (e.g., "summary-maker")
   - Note your team name and project name

2. **Initialize Convex properly**
   ```bash
   # Remove any old configuration
   rm -rf .convex
   
   # Run Convex dev - it will prompt for team/project
   npx convex dev
   ```
   
   When prompted:
   - **Team name:** Your team name from the dashboard
   - **Project name:** Your project name from the dashboard
   
   This will create a `convex.json` file with the correct configuration.

3. **Alternative: Manual configuration**
   
   If automatic setup doesn't work, create `convex.json` in your project root:
   ```json
   {
     "functions": "convex/",
     "generateCommonJSApi": false,
     "node": {
       "externalPackages": []
     }
   }
   ```
   
   Then set the deployment URL in `.env.local`:
   ```env
   NEXT_PUBLIC_CONVEX_URL=https://your-project-name.convex.cloud
   ```

## Step 5: Encryption Key

Generate a secure encryption key for API key storage:

```bash
# On Linux/Mac
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

Add to `.env.local`:
```env
ENCRYPTION_KEY=your-generated-key-here
```

## Step 6: Final Environment Variables

Your complete `.env.local` should look like:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://your-app.clerk.accounts.dev

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_BASIC=price_...
STRIPE_PRICE_ID_PLUS=price_...
STRIPE_PRICE_ID_PRO=price_...

# Encryption
ENCRYPTION_KEY=your-generated-key-here

# Existing OpenRouter keys (if you have them)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_SITE_URL=http://localhost:3420
OPENROUTER_APP_NAME=Summary Maker

# Site URL (for production)
NEXT_PUBLIC_SITE_URL=http://localhost:3420
```

## Step 7: Run the Application

1. **Start Convex dev server** (in a separate terminal):
   ```bash
   npx convex dev
   ```

2. **Start Next.js dev server**:
   ```bash
   npm run dev
   ```

3. **Test the setup**:
   - Open http://localhost:3420
   - Try signing up/logging in
   - Check that user is created in Convex
   - Test subscription flow (in Stripe test mode)

## Step 8: Understanding the Application Layout

### Main Interface (Zemni)
- **History Sidebar**: Accessible via the menu icon on the left. Contains all your previous generations, grouped by date.
- **Quick Settings**: The floating gear icon in the top right allows you to quickly toggle between Light/Dark mode and access full settings.
- **Input Panel**: Upload your PDF or Markdown files here.
- **Model Selector**: Choose between available AI models. Some models may be locked based on your subscription tier.
- **Output Tabs**: Your generated summaries, flashcards, and quizzes appear here as tabs. You can view them in a split-screen mode on desktop.

### Settings & Account
The settings page (/settings) is divided into several tabs:
- **Account**: Manage your profile, view usage statistics, and set **System-wide Guidelines** (instructions that apply to all your generations).
- **Models**: View all available models and their pricing. If a model requires a higher tier, you'll see an "Upgrade" prompt.
- **Notion**: Configure your Notion integration (coming soon/in progress).
- **Subscription**: Manage your current plan and billing via Stripe.

### Model Tiers
Models are categorized into tiers:
- **Free**: standard models (e.g., Llama 3).
- **Basic/Plus/Pro**: Access to more powerful models (e.g., Claude 3.5, GPT-4o) depending on your plan.

## Troubleshooting

### Convex Issues
- Make sure `npx convex dev` is running
- Check that `NEXT_PUBLIC_CONVEX_URL` is set correctly
- Verify `CLERK_JWT_ISSUER_DOMAIN` is set in Convex dashboard

### Clerk Issues
- Verify JWT template is named "convex" exactly
- Check that issuer domain matches in both Clerk and Convex
- Ensure middleware.ts is in the project root
- **Console Errors During Development**: If you see "SignedIn can only be used within the <ClerkProvider /> component" errors in the console during hot reload, this is expected behavior. The Error Boundary catches these errors and the app works correctly. These errors should not occur in production.

### Stripe Issues
- Use test mode keys for development
- Verify webhook endpoint is accessible
- Check webhook secret matches in environment variables
- For local testing, use Stripe CLI: `stripe listen --forward-to localhost:3420/api/stripe/webhook`
- Make sure Stripe CLI is authenticated: `stripe login`
- If webhook secret doesn't work, restart the `stripe listen` command to get a new one

### Authentication Issues
- Clear browser cookies and try again
- Check browser console for errors
- Verify all environment variables are set correctly
- If you see ClerkProvider errors during development, wait a few seconds for the context to initialize

## Production Deployment

1. **Update environment variables** in your hosting platform (Vercel, etc.)
2. **Use production keys** for Clerk and Stripe
3. **Update webhook URL** in Stripe to your production domain
4. **Set `NEXT_PUBLIC_SITE_URL`** to your production URL
5. **Run Convex in production mode**: `npx convex deploy`

## Security Notes

- Never commit `.env.local` to git
- Use different keys for development and production
- Rotate encryption keys periodically
- Keep Stripe webhook secrets secure
- Use environment-specific Convex deployments

## Support

For issues:
- Convex: https://docs.convex.dev
- Clerk: https://clerk.com/docs
- Stripe: https://stripe.com/docs
