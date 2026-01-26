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

## Next Steps (Prioritized)

### High Priority - MVP Completion

1. **Implement caching for generated content** (mentioned in MVP 2.3)
   - Cache key: `(docHash, mode, model, params)` -> reuse existing outputs
   - Store in localStorage or IndexedDB
   - Check cache before generating to save costs and improve performance
   - Show cache hit indicator in UI

2. **Enhanced error recovery and retry mechanisms**
   - Add retry buttons for failed generations
   - Better error messages with actionable suggestions
   - Automatic retry with exponential backoff for transient errors
   - Save partial results on failure

3. **Performance optimizations**
   - Lazy load heavy components
   - Optimize re-renders with better memoization
   - Debounce expensive operations
   - Virtual scrolling for large outputs

### Medium Priority - User Experience

4. **User settings (localStorage-based, no accounts needed)**
   - Language preference (UI language)
   - Default model selection
   - Custom default prompts/structure hints
   - Theme persistence (already done, but could add more options)
   - Export format preferences

5. **Enhanced export options**
   - Export summary as PDF
   - Batch export multiple outputs
   - Export history as archive
   - Custom export templates

6. **Better loading and progress indicators**
   - More granular progress for long operations
   - Estimated time remaining
   - Cancel operations mid-generation
   - Background generation with notifications

### Low Priority - Nice to Have

7. **Analytics and insights**
   - Usage statistics (tokens used, costs, documents processed)
   - Most used models
   - Generation success rates
   - Export frequency

8. **Documentation improvements**
   - In-app help/tutorial
   - Keyboard shortcuts reference
   - FAQ section
   - Better README with setup instructions

9. **Quality of life improvements**
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
