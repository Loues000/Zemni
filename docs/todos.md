# TODOs (MVP-first)

## Notes

- ⚠️ **Clerk Development Keys**: Clerk has been loaded with development keys. Development instances have strict usage limits and should not be used when deploying your application to production. Learn more: https://clerk.com/docs/deployments/overview
  - Make sure to use production keys (`pk_live_...`) when deploying to production
  - Development keys (`pk_test_...`) are only for local development

## Completed

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
- ✅ Loading states for Stripe checkout redirects
- ✅ Improved mobile responsiveness for settings pages
- ✅ Testing infrastructure foundation (Vitest + initial tests)
- ✅ Error tracking utility foundation

## Next Steps (Prioritized)

### High Priority - MVP Completion

1. **Performance optimizations**
   - Lazy load heavy components (mostly done in AppClient)
   - Optimize re-renders with better memoization (mostly done with useMemo/useCallback)
   - Debounce expensive operations
   - Virtual scrolling for large outputs

2. **Mobile Optimization & Layout Polish**
   - Refine mobile view for the new tab-based settings
   - Ensure "Zemni" header looks premium on all screen sizes
   - Smooth transitions between Setup and Output views on mobile

### Medium Priority - User Experience

3. **User Guidelines (Next Core Feature)**
   - Implement backend persistence for "User Guidelines" in Convex `users` table
   - Integrate these guidelines into the system prompt for all generation modes
   - Add "Save" feedback for guidelines in AccountTab

4. **User settings (localStorage + Cloud sync)**
   - Language preference (UI language) (guidlines hardcode to german)
   - Per-mode defaults (e.g., flashcard density, quiz batch sizes)
   - More customization presets / templates
   - Export format preferences and templates

3. **Enhanced export options**
   - Export summary as PDF
   - Batch export multiple outputs
   - Export history as archive
   - Custom export templates

4. **Better loading and progress indicators**
   - More granular progress for long operations
   - Estimated time remaining
   - Cancel operations mid-generation
   - Background generation with notifications


### Low Priority - Nice to Have

5. **Analytics and insights**
   - Usage statistics (tokens used, costs, documents processed)
   - Most used models
   - Generation success rates
   - Export frequency

6. **Documentation improvements**
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

7. **Quality of life improvements**
   - Keyboard shortcuts for common actions
   - Bulk operations (delete multiple history items)
   - Search/filter in history
   - Recent files quick access

# Out of scope right now (Re-evaluating)

- Bring-your-own AI keys (OpenRouter/Claude/OpenAI/Gemini/...)
- User-level "large overview" dashboards across many documents
- Concept maps / prerequisite graphs
- Full lecture / exam-like quizzes
