---
name: Settings and Profile UI Redesign
overview: Redesign the settings page and profile UI to move the heading to the sidebar, make the header thinner, add a user button to the history sidebar footer, and ensure settings require login with a visible login button.
todos:
  - id: settings-layout-refactor
    content: "Refactor SettingsLayout: move title to sidebar, create thin header bar with back link and action buttons"
    status: pending
  - id: settings-css-update
    content: Update CSS for thin settings header and sidebar title styling
    status: pending
    dependencies:
      - settings-layout-refactor
  - id: history-sidebar-footer
    content: Add footer section to HistorySidebar with user/login button
    status: pending
  - id: history-sidebar-css
    content: Add CSS styles for sidebar footer and user button
    status: pending
    dependencies:
      - history-sidebar-footer
  - id: settings-access-control
    content: Ensure settings page shows login button in header when signed out
    status: pending
    dependencies:
      - settings-layout-refactor
---

# Settings and Profile UI Redesign

## Overview

Redesign the settings page layout inspired by T3 Chat: move the heading to the sidebar, create a thin header with only essential buttons, add a user button to the history sidebar footer, and ensure proper login gating for settings.

## Current Structure Analysis

- Settings page has a large header with title/subtitle taking up space (`app/settings/components/SettingsLayout.tsx`)
- Main app header includes title, settings button (`app/components/app-client.tsx`)
- History sidebar has no footer/user button (`components/features/HistorySidebar.tsx`)
- Settings page shows login prompt when signed out (`app/settings/page.tsx`)

## Changes Required

### 1. Settings Page Layout (`app/settings/components/SettingsLayout.tsx`)

- **Move heading to sidebar**: Move "Settings" title and subtitle from `settings-header` to `settings-sidebar-header`
- **Thin header**: Replace current header with a minimal top bar containing:
- Settings button and Login button (right) - similar to T3 Chat's header pattern
- **Remove large header card**: The current `settings-header` with large padding and title should be removed or made minimal

### 2. Settings Page CSS (`app/globals.css`)

- **Update `.settings-header`**: Reduce padding, remove large title styling, make it a thin bar
- **Add `.settings-header-bar`**: New class for the thin header (height ~48-56px)
- **Update `.settings-sidebar-header`**: Add title and subtitle styling here instead
- **Responsive**: Ensure thin header works on mobile

### 3. History Sidebar Footer (`components/features/HistorySidebar.tsx`)

- **Add footer section**: Add a `sidebar-footer` div at the bottom of the sidebar
- **User button**: Add a user/profile button that:
- Shows user avatar/initial when logged in (links to settings)
- Shows "Login" button when signed out (opens Clerk sign-in)
- **Styling**: Match T3 Chat's footer pattern - simple, at bottom of sidebar

### 4. History Sidebar CSS (`app/globals.css`)

- **Add `.sidebar-footer`**: Style for footer section with padding and border-top
- **Add `.sidebar-user-button`**: Style for user button (avatar + name or login button)
- **Layout**: Ensure footer stays at bottom, content scrolls above it

### 5. Settings Page Access Control (`app/settings/page.tsx`)

- **Login requirement**: Keep current `ClerkSignedIn`/`ClerkSignedOut` logic
- **Login button visibility**: Ensure login button is visible in the thin header when signed out
- **Redirect behavior**: When accessing `/settings` while signed out, show login prompt but keep header visible

### 6. Main App Header (`app/components/app-client.tsx`)

- **Keep thin**: Header should remain compact (already has `header-compact` class)
- **Settings button**: Keep current settings popover button
- **Login button**: Add login button next to settings button when signed out (optional enhancement)

## File Changes

1. **`app/settings/components/SettingsLayout.tsx`**

- Move title/subtitle to sidebar header
- Create thin header bar with back link and action buttons
- Remove large header card

2. **`components/features/HistorySidebar.tsx`**

- Add footer prop/state for user authentication
- Add user button component in footer
- Import Clerk components for login state

3. **`app/globals.css`**

- Update `.settings-header` styles (make thin)
- Add `.settings-header-bar` styles
- Update `.settings-sidebar-header` to include title
- Add `.sidebar-footer` and `.sidebar-user-button` styles

4. **`app/settings/page.tsx`**

- Ensure login button shows in header when signed out
- Keep access control logic

## Design Inspiration (T3 Chat)

- Thin header bar with minimal content
- Sidebar contains page title and navigation
- Footer with user/login button at bottom of sidebar
- Clean, minimal spacing without excessive containers

## Implementation Notes

- Maintain existing responsive breakpoints
- Keep accessibility (ARIA labels, keyboard navigation)
- Preserve existing Clerk authentication flow
- Ensure smooth transitions between logged in/out states