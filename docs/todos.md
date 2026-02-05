# TODOs (MVP-first)

## Notes

- ⚠️ **Clerk Development Keys**: Clerk has been loaded with development keys. Development instances have strict usage limits and should not be used when deploying your application to production. Learn more: https://clerk.com/docs/deployments/overview
  - Make sure to use production keys (`pk_live_...`) when deploying to production
  - Development keys (`pk_test_...`) are only for local development

- ✅ **Encryption Key**: Encryption key is in `.env.local` and can always be used. The code automatically reads from `ENCRYPTION_KEY` environment variable.

- 📊 **Rate Limiting vs Usage Limits** (Different things):
  - **Usage Limits** (in Convex): Monthly quotas per subscription tier tracked in `convex/usage.ts`:
    - Free: 5 generations/month
    - Basic: 20 generations/month
    - Plus: 100 generations/month
    - Pro: 200 generations/month
    - ✅ Already implemented in Convex, working correctly
  - **Rate Limiting** (in-memory): Short-term throttling to prevent abuse:
    - Key management: 5 operations/hour per user
    - Generation endpoints: 30 requests/hour per user
    - ⚠️ Currently in-memory (`lib/rate-limit.ts`) - resets on server restart
    - ⚠️ Should be moved to Convex for persistence (see Production Readiness tasks below)

## Completed
- DONE Added Plus/Pro price tags in Subscription tab and removed SaveStatus from main page
- DONE Paused billing UI via NEXT_PUBLIC_ENABLE_BILLING, forced new users to free tier, and added legal placeholders + revert guide

- ✅ Switched subscription system from Stripe to Polar (API routes, Convex, settings UI, docs/legal)
- ✅ Clean up code, split files for better overview
- ✅ Heavy usage improvement, UI/UX makeover with logic about paths between buttons etc.
- ✅ Implemented client-side caching for generated outputs
- ✅ Added robust retry and backoff flows for generation failures
- ✅ Full-page settings foundation with local persistence
- ✅ Fixed ClerkProvider SSR/hydration issues - ClerkWrapper now handles SSR properly
- ✅ Fixed TypeScript errors in settings pages (getUsageStats args)
- ✅ Implemented Clerk Authentication (Login/Accounts) with Convex synchronization
- ✅ Completely redesigned Settings UI with horizontal tab navigation
- ✅ Implemented Subscription Tiers logic for models (Free, Basic, Plus, Pro)
- ✅ Added "Zemni" header and integrated history access into InputPanel
- ✅ Advanced Account tab with usage stats and user information display
- ✅ Unified duplicate `isModelAvailable()` logic between server and client
- ✅ Account deletion confirmation modal
- ✅ Toast notification system for user feedback
- ✅ Loading states for Polar checkout redirects
- ✅ Improved mobile responsiveness for settings pages
- ✅ Testing infrastructure foundation (Vitest + initial tests)
- ✅ Error tracking utility foundation
- ✅ Session persistence when navigating to/from settings (useSessionPersistence hook)
- ✅ Generation bar/progress indicator (basic implementation exists)
- ✅ Export button functionality (basic implementation exists)
- ✅ Tier ad cards in SubscriptionTab (basic implementation exists)
- ✅ Model selection page (ModelsTab.tsx)
- ✅ Monthly usage display infrastructure (needs fixes)
- ✅ User Guidelines backend persistence in Convex `users` table
- ✅ User Guidelines integrated into all generation modes (summarize, refine, flashcards, quiz, section-summary)
- ✅ User Guidelines save feedback in AccountTab
- ✅ Language preferences backend persistence in Convex
- ✅ Language preferences integrated into all generation modes
- ✅ Language preferences save feedback in AccountTab

## Next Steps (Prioritized)

### Critical Priority - Bugs & Critical Issues

1. **🔴 [VERY IMPORTANT] Generation Performance & Testing**
   - Generation still takes too long - needs thorough testing and optimization
   - Investigate timeout issues and model response times
   - Optimize API calls and reduce unnecessary processing
   - Add performance monitoring and metrics

2. **🔴 [VERY IMPORTANT] Model Availability with API Keys**
   - Key usage to higher tier not working - users with API keys should be able to use higher tier models
   - Error: "This model is not available for your subscription tier" appears even when user has valid API key
   - Fix `isModelAvailableViaApiKey()` logic in `lib/model-availability.ts`
   - Ensure API key check happens before subscription tier check
   - Related: POST /api/quiz 403 errors (see terminal logs 996-1000)

3. **🔴 [VERY IMPORTANT] Flashcards Generation Quality**
   - Number of cards generation needs improvement
   - JSON parsing errors for flashcards (see terminal logs 955-983)
   - "Unterminated string in JSON" errors for model x-ai/grok-4.1-fast
   - Improve JSON extraction and error handling in flashcards API
   - Add better validation and retry logic for malformed JSON responses

4. **Notion Token Authentication Error**
   - Error: "[Request ID: 8b6a86252d1343b4] Server Error Uncaught Error: Not authenticated at handler (../convex/users.ts:253:17)"
   - Fix authentication check in `convex/users.ts` `updateNotionConfig` mutation
   - Ensure proper auth context is passed when updating Notion configuration

5. **Generation Restarts When Coming Out of Settings**
   - Generation state is lost or restarted when navigating back from settings
   - Fix session persistence to properly handle ongoing generations
   - Ensure generation continues/resumes correctly after returning from settings

6. **Monthly Usage Display Not Working**
   - Monthly usage statistics not displaying correctly in Account tab
   - Fix usage calculation and display logic
   - Ensure proper date range filtering for monthly stats

### High Priority - MVP Completion

7. **UI/UX Improvements**
   - **Improve generation bar**: Better progress indicators, estimated time remaining, cancel functionality
   - **Better export button**: Improve design, add loading states, better error handling
   - **Modernize tier-ad-cards**: Update design and information in `app/settings/components/SubscriptionTab.tsx` to be more modern and appealing
   - **Better looking model page**: Redesign `app/settings/components/ModelsTab.tsx` for better visual appeal and usability
   - **Upgrade to downgrade when higher sub**: Show "downgrade" option instead of "upgrade" when user has higher subscription tier

8. **Language Support**
   - Check language detection and add more language support when possible
   - Improve language handling in generated content
   - Add language preferences in user settings

9. **Performance optimizations**
   - Lazy load heavy components (mostly done in AppClient)
   - Optimize re-renders with better memoization (mostly done with useMemo/useCallback)
   - Debounce expensive operations
   - Virtual scrolling for large outputs

10. **Mobile Optimization & Layout Polish**
   - Refine mobile view for the new tab-based settings
   - Ensure "Zemni" header looks premium on all screen sizes
   - Smooth transitions between Setup and Output views on mobile

### Medium Priority - User Experience

11. ~~**User Guidelines (Next Core Feature)**~~ ✅ **COMPLETED**
   - ✅ Backend persistence for "User Guidelines" in Convex `users` table
   - ✅ Integrated into system prompt for all generation modes (summarize, refine, flashcards, quiz, section-summary)
   - ✅ Save feedback in AccountTab ("Custom guidelines saved.")
   - ✅ Language preferences also fully implemented with save feedback

12. **User settings (localStorage + Cloud sync)**
   - Language preference (UI language) (guidelines hardcode to german)
   - Per-mode defaults (e.g., flashcard density, quiz batch sizes)
   - More customization presets / templates
   - Export format preferences and templates

13. **Enhanced export options**
   - Export summary as PDF
   - Batch export multiple outputs
   - Export history as archive
   - Custom export templates

14. **Better loading and progress indicators**
   - More granular progress for long operations (partially addressed in Critical Priority)
   - Estimated time remaining (partially addressed in Critical Priority)
   - Cancel operations mid-generation (partially addressed in Critical Priority)
   - Background generation with notifications


### Low Priority - Nice to Have

15. **Analytics and insights**
   - Usage statistics (tokens used, costs, documents processed) - partially implemented
   - Most used models
   - Generation success rates
   - Export frequency

16. **Documentation improvements**
   - In-app help/tutorial
   - Keyboard shortcuts reference
   - FAQ section
   - Better README with setup instructions
   - **User Guide Ergänzungen** (nicht vollständig dokumentiert):
     - OpenRouter Setup: Detaillierte Anleitung zum Erstellen eines Accounts und Abrufen des API Keys (aktuell nur als env variable erwähnt)
     - Notion Setup: Schritt-für-Schritt Anleitung zur Integration (Integration erstellen, Database ID finden, Berechtigungen, per-user vs. global config)
     - Middleware.ts: Erklärung was drin sein muss und warum es benötigt wird (aktuell nur "ensure middleware.ts is in the project root")
     - Model Configuration: Erklärung der `config/openrouter-models.json` Struktur und wie man eigene Modelle hinzufügt (subscription_tier, etc.)
     - Benchmark System: Dokumentation des Python-basierten Benchmark-Systems (optional, für Entwickler)
     - Keyboard Shortcuts: Integration der `docs/keyboard-shortcuts.md` in den user_guide oder Verweis darauf

17. **Quality of life improvements**
   - Keyboard shortcuts for common actions
   - Bulk operations (delete multiple history items)
   - Search/filter in history
   - Recent files quick access

# Out of scope right now (Re-evaluating)

- User-level "large overview" dashboards across many documents
- Concept maps / prerequisite graphs
- Full lecture / exam-like quizzes

## Production Readiness Tasks

### Sentry Configuration (Ready to Use)
- ✅ **Sentry is fully built-in and configured** - all config files are ready:
  - Client-side: `instrumentation-client.ts` (uses `NEXT_PUBLIC_SENTRY_DSN`)
  - Server-side: `sentry.server.config.ts` (uses `SENTRY_DSN`)
  - Edge: `sentry.edge.config.ts` (uses `SENTRY_DSN`)
- ⚠️ **Action Required**: Just need to set environment variables:
  - `NEXT_PUBLIC_SENTRY_DSN` - for browser error tracking
  - `SENTRY_DSN` - for server and edge error tracking
- **How to get DSN**: 
  1. Go to https://sentry.io (free tier available)
  2. Create account and new project (select "Next.js")
  3. Go to Settings → Client Keys (DSN)
  4. Copy the DSN and set as environment variables
- **Note**: App works without this, but you won't have error tracking. Sentry is ready to use once DSN is set.

### Rate Limiting Migration to Convex
- ⚠️ **Current**: In-memory rate limiting in `lib/rate-limit.ts`
  - Resets on server restart
  - Not shared across multiple server instances
- **Action**: Move rate limiting to Convex for persistence
  - Create rate limit tracking in Convex schema
  - Implement Convex mutations/queries for rate limit checks
  - Update API routes to use Convex rate limiting instead of in-memory
- **Priority**: Medium (should be done before significant scale)

### Hash Function Review
- ⚠️ **Current**: `hashKey()` in `lib/encryption.ts` uses simple hash algorithm
- **Action**: Verify if stronger hash implementation exists (e.g., `.enc.local` or similar)
  - If stronger hash exists, ensure it's being used correctly
  - If not, consider implementing SHA-256 for security-sensitive operations
- **Priority**: Medium (review needed)

## Bug Fixes (Resolved)

*This section tracks bugs that have been fixed by AI agents to prevent future occurrences.*

- Fixed JSX parse error in legal placeholder links by removing '<-' from anchor text.

