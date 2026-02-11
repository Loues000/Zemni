# Free Tier User Handling (Unauthenticated Users)

## Current Implementation

### How It Works

The system **already supports** free tier users who are not logged in (no account ID). Here's how:

1. **History Storage:**
   - **Authenticated users:** Data saved to Convex database (persistent, cross-device)
   - **Unauthenticated users:** Data saved to `localStorage` (browser-only, temporary)
   - Implementation: `hooks/useHistory.ts` automatically detects authentication status and switches storage

2. **API Access:**
   - **Unauthenticated users:** Can use the app if:
     - They provide their own API keys (OpenRouter, OpenAI, Anthropic, Google)
     - OR system API keys are available (if `OPENROUTER_API_KEY` is set)
   - **Model availability:** Treated as "free" tier (only free-tier models available)
   - Implementation: `lib/api-helpers.ts` - `getUserContext()` returns `null` for unauthenticated users

3. **Usage Tracking:**
   - **Authenticated users:** Usage tracked in Convex `usage` table
   - **Unauthenticated users:** Usage NOT tracked (no user ID to associate with)

### Code References

**History Storage Fallback:**
```22:49:hooks/useHistory.ts
  // Load history from Convex when available, fallback to localStorage for unauthenticated users
  useEffect(() => {
    if (currentUser === undefined) {
      // Still loading user
      return;
    }

    if (currentUser && documents !== undefined) {
      // User is authenticated, use Convex
      setIsLoading(false);
      setHistory(sortHistory(historyFromConvex));
    } else if (!currentUser) {
      // Not authenticated, fallback to localStorage
      setIsLoading(false);
      const { loadHistoryFromStorage } = require("@/lib/history-storage");
      setHistory(loadHistoryFromStorage());
    }
  }, [currentUser, documents, historyFromConvex]);

  const updateHistoryState = useCallback((updater: (prev: HistoryEntry[]) => HistoryEntry[]): void => {
    if (!currentUser) {
      // Not authenticated, use localStorage fallback
      const { loadHistoryFromStorage, saveHistoryToStorage } = require("@/lib/history-storage");
      const current = loadHistoryFromStorage();
      const next = sortHistory(updater(current));
      saveHistoryToStorage(next);
      setHistory(next);
      return;
    }
```

**API Context (Unauthenticated = null):**
```32:36:lib/api-helpers.ts
export async function getUserContext(): Promise<UserContext | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }
```

**Document Saving (Requires Auth):**
```82:86:convex/documents.ts
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
```

## Limitations & Considerations

### Current Limitations

1. **Data Persistence:**
   - localStorage is browser-specific (not synced across devices)
   - Limited storage (~5-10MB per domain)
   - Data lost if user clears browser data
   - Data lost if user switches browsers/devices

2. **No Usage Tracking:**
   - Cannot track usage for unauthenticated users
   - Cannot enforce usage limits per tier
   - Cannot provide usage analytics

3. **No Cross-Device Sync:**
   - History only available on the device where it was created
   - Cannot access from mobile/tablet/other browsers

4. **No Account Features:**
   - Cannot save API keys (must enter each time)
   - Cannot configure Notion integration
   - Cannot access settings/preferences
   - Cannot export/import history

### Benefits of Current Approach

1. **Zero Friction:**
   - Users can try the app immediately without signup
   - No account creation barrier
   - Works offline (once loaded)

2. **Privacy:**
   - Data stays in user's browser
   - No server-side storage of unauthenticated user data

3. **Cost:**
   - No database storage costs for unauthenticated users
   - No user management overhead

## Recommended Improvements

### 1. UX Enhancements (High Priority)

**A. Login Prompt (Before/During Generation):**
- Show a banner/modal **before or during** first generation (not after)
- Message: "Create a free account to save your work permanently and access it from any device"
- **Why before/during:** 
  - History is automatically saved to localStorage when generation completes
  - If shown after generation, data is already in localStorage (safe but not ideal UX)
  - Better to prompt early so data goes directly to Convex if they sign up
  - Alternative: Show after generation but emphasize data is already saved locally, and offer migration on signup
- Benefits: Convert unauthenticated users to authenticated free tier
- **Note:** Unauthenticated users cannot access settings (correctly restricted), so keep prompts minimal

**B. localStorage Warning:**
- Show a subtle indicator when using localStorage
- Message: "Your work is saved locally. Sign in to save permanently."
- Location: History sidebar or settings area

**C. Export/Import for Unauthenticated Users:**
- Allow export to JSON file (already possible via history export)
- Allow import from JSON file
- Helps users migrate data when they create an account

### 2. Technical Improvements (Medium Priority)

**A. localStorage Size Management:**
- Monitor localStorage usage
- Warn users when approaching limit
- Implement cleanup of old entries
- Consider IndexedDB for larger storage (future)

**B. Migration Flow:**
- When user signs up, offer to migrate localStorage data to Convex
- One-time migration on first login
- Preserve all history entries

**C. Anonymous Session Tracking:**
- Optional: Create temporary session IDs for unauthenticated users
- Track basic usage metrics (not tied to user identity)
- Helps understand free tier usage patterns
- Privacy-friendly (no PII, just metrics)

### 3. Feature Parity (Low Priority)

**A. Temporary API Key Storage:**
- Store API keys in localStorage for unauthenticated users
- Encrypted with browser-based key
- Clear on logout/browser clear
- Note: Less secure than server-side encryption

**B. Temporary Settings:**
- Store theme, structure hints, etc. in localStorage
- Already partially implemented (theme, nerd stats)
- Extend to other preferences

## Implementation Examples

### Example 1: Login Prompt Before/During Generation

```typescript
// In app-client.tsx or useGeneration.ts
useEffect(() => {
  if (currentUser) return; // Already logged in
  
  // Show prompt before first generation attempt (when user uploads file or clicks generate)
  if (extractedText && !hasShownLoginPrompt && !currentUser) {
    setShowLoginPrompt(true);
    setHasShownLoginPrompt(true);
  }
}, [extractedText, currentUser]);

// OR show during generation (when status changes to "summarizing")
useEffect(() => {
  if (currentUser) return;
  if (status === "summarizing" && !hasShownLoginPrompt) {
    setShowLoginPrompt(true);
    setHasShownLoginPrompt(true);
  }
}, [status, currentUser]);

// Note: History is automatically saved to localStorage when generation completes
// (see app-client.tsx line 458-464), so data is safe even if user doesn't login
```

### Example 2: localStorage Migration on Signup

```typescript
// In UserSync.tsx or after Clerk sign-in
useEffect(() => {
  if (currentUser && !hasMigratedLocalStorage) {
    const localHistory = loadHistoryFromStorage();
    if (localHistory.length > 0) {
      // Migrate each entry to Convex
      localHistory.forEach(entry => {
        upsertDocument(historyEntryToDocument(entry, currentUser._id));
      });
      // Clear localStorage after migration
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      setHasMigratedLocalStorage(true);
    }
  }
}, [currentUser]);
```

### Example 3: localStorage Size Warning

```typescript
// In useHistory.ts
const checkStorageSize = () => {
  try {
    const used = new Blob([JSON.stringify(localStorage)]).size;
    const limit = 5 * 1024 * 1024; // 5MB typical limit
    if (used > limit * 0.8) {
      // Show warning
      setStorageWarning(true);
    }
  } catch (e) {
    // Ignore
  }
};
```

## Decision Matrix

| Feature | Unauthenticated (localStorage) | Authenticated Free (Convex) |
|---------|-------------------------------|----------------------------|
| **Data Persistence** | Browser-only, temporary | Permanent, cross-device |
| **Storage Limit** | ~5-10MB | Unlimited (within reason) |
| **Usage Tracking** | ❌ No | ✅ Yes |
| **API Key Storage** | ❌ No (must enter each time) | ✅ Yes (encrypted) |
| **Notion Integration** | ❌ No | ✅ Yes |
| **Settings Sync** | ❌ Browser-only | ✅ Cross-device |
| **History Export/Import** | ✅ JSON only | ✅ JSON + Convex sync |
| **Account Required** | ❌ No | ✅ Yes (free signup) |

## Recommendations

1. **Keep current localStorage fallback** - It works well for trial users
   - ✅ History is automatically saved to localStorage when generation completes (see `app-client.tsx` line 458-464)
   - ✅ Data is safe even if user doesn't login immediately
2. **Add login prompts BEFORE/DURING generation** - Better UX than after
   - Show when user uploads file or clicks generate (before generation starts)
   - OR show when generation starts (status = "summarizing")
   - Why: Data goes directly to Convex if they sign up, rather than needing migration
   - **Keep prompts minimal** - Unauthenticated users can't access settings (correctly restricted)
3. **Implement migration flow** - Help users preserve data when signing up
   - Automatically migrate localStorage → Convex on first login
   - One-time migration, then clear localStorage
4. **Add localStorage warnings** - Make limitations clear (optional, low priority)
5. **Consider usage limits** - If needed, require login after X generations (future)

## Future Considerations

If you want to enforce stricter limits on free tier:

1. **Require Login for Free Tier:**
   - Remove localStorage fallback
   - Force signup before first use
   - Pro: Better tracking, user acquisition
   - Con: Higher friction, fewer trial users

2. **Anonymous Sessions:**
   - Create temporary session IDs
   - Store in cookies/localStorage
   - Track usage per session
   - Pro: Better analytics, can enforce limits
   - Con: More complex, privacy concerns

3. **Hybrid Approach:**
   - Allow 2-3 generations without login
   - Require login after limit
   - Pro: Balance between friction and tracking
   - Con: More complex logic

## Summary

**Current State:** ✅ Working
- Free tier users without accounts can use the app
- Data stored in localStorage (browser-only)
- No usage tracking for unauthenticated users
- System already handles this gracefully

**Recommended Actions:**
1. Add UX prompts to encourage signup
2. Implement localStorage → Convex migration on signup
3. Add warnings about localStorage limitations
4. Consider usage limits if abuse becomes an issue

The current implementation is solid for a free tier. The main improvements are UX-focused to convert trial users to authenticated free tier accounts.
