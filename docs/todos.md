# TODOs (MVP-first)

## Completed

- ✅ Clean up code, split files for better overview
  - Extracted handlers to `lib/handlers/` (file-handlers, tab-handlers, generation-handlers, export-handlers, quiz-handlers, summary-handlers)
  - Created custom hooks in `hooks/` (useAppState, useOutputManagement, useFileHandling, useGeneration, useExport, useQuizState, useEditing)
  - Refactored `app-client.tsx` from 1591 to ~960 lines with better structure
- ✅ Heavy usage improvement, UI/UX makeover with logic about paths between buttons etc.
  - Improved button state management with clearer navigation flows
  - Enhanced accessibility (aria-labels, titles, tooltips)
  - Better error handling and user feedback
  - Improved button disabled states with helpful messages
- ✅ Implemented client-side caching for generated outputs
  - Cache keys derive from `(docHash, mode, model, params)` and live in `lib/cache.ts`
  - Cache entries persist in `localStorage`, are validated for age, size-limited, and surfaced via cache badges in `components/features/*`
- ✅ Added robust retry and backoff flows for generation failures
  - `lib/utils/retry.ts` handles exponential backoff while `generation-handlers` flags retryable errors
  - Retry state and UI indicators (e.g., `components/features/OutputTabs.tsx`) let users retry failed tabs without losing context
- ✅ Full-page settings foundation with local persistence
  - New route at `app/settings/page.tsx` with a richer layout inspired by the reference
  - Defaults (model + structure hints), theme toggle, and history JSON/ZIP import/export are now centralized there

## Next Steps (Prioritized)

### High Priority - MVP Completion

1. **Performance optimizations**
   - Lazy load heavy components
   - Optimize re-renders with better memoization
   - Debounce expensive operations
   - Virtual scrolling for large outputs

### Medium Priority - User Experience

2. **User settings (localStorage-based, no accounts needed)**
   - Language preference (UI language)
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

7. **Quality of life improvements**
   - Keyboard shortcuts for common actions
   - Bulk operations (delete multiple history items)
   - Search/filter in history
   - Recent files quick access

# Out of scope right now

- User login / accounts
- Subscription tiers based on models
- Bring-your-own AI keys (OpenRouter/Claude/OpenAI/Gemini/...)
- User-level "large overview" dashboards across many documents
- Concept maps / prerequisite graphs
- Full lecture / exam-like quizzes
