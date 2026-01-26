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

## Next Steps

- Much more to come...

# Out of scope right now

- User login / accounts
- User settings (language choice, customs default prompts)
- Subscription tiers based on models
- Bring-your-own AI keys (OpenRouter/Claude/OpenAI/Gemini/...)
- User-level "large overview" dashboards across many documents
- Concept maps / prerequisite graphs
- Full lecture / exam-like quizzes
