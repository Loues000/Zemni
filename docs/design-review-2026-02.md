# Zemni Design Review

**Date:** February 2026  
**Version:** Current (Post-mobile-optimizations)  
**Scope:** Comprehensive review of Web and Mobile interfaces

---

## Executive Summary

Zemni employs a clean, minimalist design philosophy with a focus on functionality over ornamentation. The interface successfully avoids "AI slop" design patterns (gradients everywhere, excessive shadows, rounded cards on cards) while maintaining good usability. However, there are opportunities for refinement in information hierarchy, spacing consistency, and mobile-specific interactions.

**Overall Grade:**
- **Desktop:** B+ (Good foundation, minor polish needed)
- **Mobile:** B (Recent improvements helped, still some rough edges)

---

## Desktop/Web Version

### Layout & Positioning

#### Structure
```
┌─────────────────────────────────────────────────────────┐
│  [Sidebar Toggle]  History                    [Settings]│ ← Header
├─────────────────┬───────────────────────────────────────┤
│                 │                                       │
│    HISTORY      │           INPUT PANEL                 │
│    SIDEBAR      │    ┌─────────────────────────────┐    │
│   (collapsible) │    │      ZEMNI HEADING          │    │
│                 │    └─────────────────────────────┘    │
│                 │    [Mode Switch: Summary/Flash/Quiz]  │
│                 │    ┌─────────────────────────────┐    │
│                 │    │  DROPZONE                   │    │
│                 │    └─────────────────────────────┘    │
│                 │    Model Selector                     │
│                 │    Structure Hints (optional)         │
│                 │                                       │
│                 ├───────────────────────────────────────┤
│                 │           OUTPUT PANEL                │
│                 │    [Tabs] [Export] [Copy]             │
│                 │    ┌─────────────────────────────┐    │
│                 │    │  Generated Content          │    │
│                 │    │  (Markdown/Flashcards/Quiz) │    │
│                 │    └─────────────────────────────┘    │
│                 │    [Refine Input Bar]                 │
├─────────────────┴───────────────────────────────────────┤
│  Zemni - Own your education.              [GitHub Icon] │ ← Footer
└─────────────────────────────────────────────────────────┘
```

#### Positive Aspects
1. **Two-column layout works well** - The sidebar + main content split is logical for the workflow (select from history → work on content)
2. **Input/Output separation** - Clear mental model: left side for setup, right side for results
3. **Zemni heading placement** - Centered above the input panel establishes brand presence without being obtrusive
4. **Sticky footer** - Provides consistent anchor with GitHub link and tagline

#### Areas for Improvement

**1. Sidebar Width (240px)**
- **Current:** Fixed 240px width feels slightly cramped when entry titles are long
- **Suggestion:** Consider 280-300px or make it resizable (drag handle)
- **Impact:** Better readability of history entries

**2. Mode Switch Position**
- **Current:** Below the Zemni heading, above the dropzone
- **Issue:** It's slightly disconnected from both the heading and the content
- **Suggestion:** Consider moving it to the same row as the heading or integrate it more visually with the input form

**3. Empty States** GO
- **Current:** "Upload PDF/MD" text in dropzone
- **Issue:** Could be more inviting with a subtle illustration or better typography hierarchy
- **Suggestion:** Larger, friendlier text; maybe a subtle upload icon

**4. Output Tabs** GO
- **Current:** Horizontal scrollable tabs in output panel header
- **Issue:** When many tabs exist, it's not obvious there are more
- **Suggestion:** Add a subtle fade indicator on the right when overflow exists

### Visual Design & Aesthetics

#### Color System
**Strengths:**
- Clean neutral palette (#fafaf9 background, #18181b text)
- Blue accent (#2563eb) is professional and accessible
- Dark mode implementation is thoughtful with proper contrast ratios

**Concerns:**
1. **Too many grays** GO- The text hierarchy uses 3-4 gray shades that are sometimes too similar 
2. **Error states** - Red (#b91c1c) is slightly harsh; could be softened
3. **Success/warning colors** - Good choices but rarely used prominently

#### Typography
**Strengths:**
- IBM Plex Sans is a solid, readable choice
- 14px base size with 1.5 line-height is comfortable
- Mobile scaling (13px base) is appropriate

**Concerns:**
1. **Heading hierarchy** - The Zemni logo (h1) and section headers could have more contrast
2. **Tab labels** - 12px font feels small for interactive elements
3. **Status text**GO - "Generating..." and similar states could be more prominent 

#### Spacing & Layout
**Strengths:**
- Consistent 12-16px padding throughout
- Good use of CSS custom properties for spacing system
- Border-based separation (1px var(--stroke)) is clean and subtle

**Concerns:**
1. **Input panel padding** - 16px feels slightly tight with multiple fields
2. **Output panel density** - Generated content could use more breathing room
3. **History sidebar groups** - "Today/Yesterday/Last week" headers could use more visual separation

### Usability & UX

#### What's Working Well
1. **Keyboard shortcuts** - Comprehensive coverage (Ctrl+Enter to generate, etc.)
2. **Settings persistence** - User preferences remembered across sessions
3. **History search** - Fast filtering with instant feedback
4. **Drag & drop** - Clear visual feedback during drag operations
5. **Model selector** - Tier-based organization with clear lock indicators

#### Friction Points

**1. Settings Discovery** GO
- **Issue:** The settings gear icon is somewhat hidden in the top bar
- **Impact:** Users might miss important configuration options
- **Suggestion:** Consider a more prominent settings entry point or onboarding hints

**2. Output Tab Management**
- **Issue:** Closing tabs requires precise clicking on small X icons
- **Impact:** Accidental clicks on tab content instead of close button
- **Suggestion:** Larger close hit areas or right-click context menu

**3. Refine Feature Visibility**
- **Issue:** The refine input bar appears only when viewing a summary
- **Impact:** Users might not discover this feature
- **Suggestion:** Not Always-visible but more prominent

**4. Split View Mode** GO
- **Issue:** The split view (comparing two outputs) is powerful but hidden
- **Suggestion:** Add a tutorial or hint for first-time users

#### Accessibility
**Strengths:**
- Good ARIA labels throughout
- Focus states are visible (blue outline)
- Color contrast meets WCAG AA standards

**Gaps:**
1. **Screen reader announcements** GO - Status changes ("Generation complete") should be announced
2. **Focus management** GO - When sidebar opens, focus should move to it
3. **High contrast mode** GO - Not explicitly supported edit: iwould love more color-schemes in the future

---

## Mobile Version

### Layout & Positioning

#### Current Structure (Post-Recent Changes)
```
┌─────────────────────────────┐
│           Zemni             │  ← Centered branding (22px)
├─────────────────────────────┤
│  [Sum][Flash][Quiz] [Setup] │  ← Mode switch + View toggle
│                 [Output]    │
├─────────────────────────────┤
│                             │
│      INPUT PANEL            │  ← (Swipe left to see Output)
│  ┌───────────────────────┐  │
│  │ Dropzone              │  │
│  └───────────────────────┘  │
│  Model: [GPT-4o ▼]          │
│  Structure: [_______]       │
│                             │
│  ┌─────────┬────────────┐   │
│  │Generate │View Output │   │  ← Clean button row
│  └─────────┴────────────┘   │
│                             │
└─────────────────────────────┘

[Swipe right]                 [Swipe left]
     ↑                             ↓
  History                     Output Panel
  Sidebar                     (Generated content)
```

#### Positive Aspects (Recent Improvements)
1. **Centered Zemni branding** - Much better visual anchor than left-aligned
2. **Controls in one row** - Mode switch and view toggle coexist well
3. **Clean button styling** - Removed the ugly full-width bar behind action buttons
4. **Swipe gestures** - Natural mobile interaction pattern

#### Remaining Issues

**1. Information Density**
- **Issue:** The input panel feels crowded on small screens
- **Specifics:** Model selector + structure hints + density control (for flashcards) stack up quickly
- **Suggestion:** Collapsible sections or accordions for optional fields

**2. View Toggle Confusion**
- **Issue:** "Setup" and "Output" might not be immediately clear
- **Alternative labels to consider:** "Input" / "Results" or "Create" / "View"

**3. Output Panel Access**
- **Issue:** When on Input view, it's not obvious how to get to Output
- **Current:** Must click "Output" tab or "View Output" button
- **Suggestion:** Consider bottom navigation bar or swipe indicator

**4. History Sidebar on Mobile**
- **Issue:** Takes full screen when opened, no peek/preview
- **Suggestion:** Consider a drawer that partially reveals content underneath

### Visual Design & Aesthetics

#### Strengths
1. **Consistent with desktop** - Same color scheme, typography, components
2. **Touch-friendly sizing** - 44-48px touch targets throughout
3. **Dark mode parity** - Mobile respects theme preference perfectly

#### Areas for Improvement

**1. Zemni Branding Size**
- **Current:** 22px font in mobile header
- **Issue:** Slightly small for being the only brand element
- **Suggestion:** 24-26px or add a subtle icon/logo mark

**2. Mode Switch Active State**
- **Current:** Blue background with white text for active mode
- **Suggestion:** Consider a pill-style underline indicator instead for cleaner look

**3. Dropzone on Mobile**
- **Current:** Large touch target but minimal visual treatment
- **Suggestion:** More prominent border or subtle background pattern when empty

**4. Status Indicators**
- **Current:** Small colored dot in corner
- **Issue:** Hard to notice during generation
- **Suggestion:** More prominent progress indicator (linear bar or pulsing effect)

### Usability & UX

#### What's Working Well
1. **Touch targets** - All buttons and controls are comfortably sized
2. **Responsive breakpoints** - 768px and 480px breakpoints catch most devices
3. **Swipe gestures** - Natural for switching between Input/Output views
4. **Generate button prominence** - Primary action is visually emphasized

#### Critical Issues

**1. Flashcards Density Control**
- **Issue:** Slider control is fiddly on touchscreens
- **Current:** Precise numeric input required
- **Suggestion:** Step buttons (+/-) or preset options (Few/Some/Many)

**2. Structure Hints Textarea**
- **Issue:** Multi-line input on mobile is cumbersome
- **Suggestion:** Single-line expandable field or voice input option

**3. Output Navigation**
- **Issue:** When multiple outputs exist, tab bar requires horizontal scrolling
- **Suggestion:** Vertical output list instead of horizontal tabs on mobile

**4. Copy/Export Actions**
- **Issue:** Small icon buttons in output header are hard to tap accurately
- **Suggestion:** Larger touch targets or bottom sheet actions

#### Performance Considerations
1. **Lazy loading** - SummaryPreview, FlashcardsMode, QuizMode are lazy-loaded (good)
2. **Animation smoothness** - View transitions (slide) should use `transform` only
3. **Memory usage** - Consider virtual scrolling for long output lists

---

## Component-Specific Reviews

### Model Selector
**Grade:** A-
- **Strengths:** Clear tier visualization, lock icons for unavailable models, grouped by subscription level
- **Improvement:** Consider showing estimated cost/time for each model

### History Sidebar
**Grade:** B+
- **Strengths:** Smart grouping (Today/Yesterday/Last week), search functionality
- **Issues:** Delete action is easy to miss; could use swipe-to-delete on mobile

### Input Panel
**Grade:** B
- **Strengths:** Clean form layout, clear labels
- **Issues:** Structure hints field could be more discoverable; flashcards density slider needs mobile refinement

### Output Panel
**Grade:** B+
- **Strengths:** Tab management is functional, split view is powerful
- **Issues:** Tab overflow handling could be better; refine bar appears/disappears abruptly

### Settings Pages
**Grade:** A-
- **Strengths:** Well-organized tabs, clear descriptions
- **Issues:** Some settings (like API keys) could use better validation feedback

---

## Recommendations Summary

### High Priority (Quick Wins)

1. **Increase mobile header branding size** (22px → 26px)
2. **Add swipe indicators** for Input/Output views on mobile
3. **Enlarge touch targets** for Copy/Export buttons in output panel
4. **Improve flashcards density control** with buttons instead of slider on mobile
5. **Add fade indicators** for horizontal scroll areas

### Medium Priority (Polish)

1. **Consider sidebar width increase** (240px → 280px)
2. **Add empty state illustrations** for dropzone
3. **Improve tab overflow visualization** (fade effect)
4. **Consolidate gray color usage** (reduce from 4 shades to 3)
5. **Add screen reader live regions** for status updates

### Long-term Considerations

1. **Mobile bottom navigation** instead of top toolbar
2. **Voice input support** for structure hints
3. **Gesture-based history management** (swipe to delete)
4. **Progressive disclosure** for advanced options (Notion integration, API keys)
5. **Onboarding flow** for new users to discover features

---

## Comparison with Similar Tools

| Feature | Zemni | Claude | ChatGPT | Perplexity |
|---------|-------|--------|---------|------------|
| Branding | Subtle, centered | Minimal | Prominent | Moderate |
| Layout | 2-col sidebar | Chat interface | Chat interface | Search-focused |
| Mobile UX | Good (recent fixes) | Good | Good | Excellent |
| Density | Moderate | Low | Moderate | High |
| Settings Discovery | Hidden (gear icon) | Menu | Menu | Menu |

**Zemni's Differentiation:**
- Focus on document processing (PDF/MD) vs. general chat
- History-centric workflow vs. thread-based
- Clean, no-frills UI vs. feature-heavy interfaces

---

## Conclusion

Zemni's design successfully avoids common pitfalls of modern AI tools (clutter, excessive gradients, confusing navigation) while maintaining a functional, professional aesthetic. The recent mobile improvements have significantly elevated the mobile experience from "usable" to "good."

**Key Successes:**
- Minimalist philosophy executed consistently
- Strong mobile optimization after recent changes
- Logical information architecture
- Good accessibility foundations

**Priority Focus Areas:**
1. Mobile output navigation (swipe hints, view toggle clarity)
2. Touch target sizing for secondary actions
3. Empty state visual design
4. Settings discoverability

Overall, Zemni is well-positioned as a clean, professional tool for document summarization with room for polish rather than fundamental redesign.

---

**Document Status:** Complete  
**Next Review Date:** March 2026 (post-implementation of recommendations)
