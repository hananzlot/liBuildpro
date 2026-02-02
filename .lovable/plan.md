

## Plan: Fix Inner Tab System

### Problem Summary
The inner tab system isn't showing tabs when clicking sidebar items because:
1. Regular clicks navigate without creating tabs
2. Middle-click handling relies on `onClick` which doesn't capture button 1 reliably

### Solution Options

**Option A (Recommended)**: Make ALL sidebar navigation create tabs automatically
- Every time a user clicks a sidebar item, it creates/activates a tab
- This gives users the browser-like tab experience they expect
- No special key combinations needed

**Option B**: Keep current behavior but fix the middle-click/Ctrl+click detection
- Regular clicks navigate normally (no tab)
- Middle-click and Ctrl+click create new tabs
- Requires users to learn the modifier key pattern

---

### Implementation (Option A - Recommended)

#### 1. Update `handleNavClick` in AppSidebar.tsx
Change the logic so that every navigation:
- Opens or activates a tab
- Then navigates to the page

```
// Every click opens as a tab
const handleNavClick = (e: React.MouseEvent, url: string, title: string) => {
  e.preventDefault();
  openTab(url, title);  // Always use openTab instead of navigate
  closeSidebar();
};
```

#### 2. Remove redundant `onMouseDown` handlers
Since we're always opening tabs, the separate middle-click handlers become unnecessary.

#### 3. Ensure all navigation points use the updated handler
- Regular nav items
- Sub-menu items  
- Any other sidebar links

---

### Technical Details

**Files to modify:**
- `src/components/layout/AppSidebar.tsx` - Update navigation handlers

**Changes:**
1. Simplify `handleNavClick` to always call `openTab()` instead of conditionally calling `navigate()`
2. Remove the separate `onMouseDown` handlers that were duplicating logic
3. The tab context's `openTab` function already handles:
   - Creating new tabs if they don't exist
   - Switching to existing tabs if they do
   - Navigating to the correct URL
   - Persisting to localStorage

