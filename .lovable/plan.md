

# Modern UI Facelift -- Incremental Plan

## Overview

This plan redesigns the app's visual layer while keeping all routes, data models, and business logic untouched. Work is broken into 4 phases, each self-contained and shippable.

---

## Phase 1: Theme & Design Token Refresh

Refine the existing CSS custom properties in `src/index.css` and Tailwind config to establish the new visual foundation.

**Changes:**
- Update `--radius` from `0.375rem` to `0.5rem` (slightly rounder corners, modern feel)
- Tighten shadow variables to be subtler (Linear-style flat-card aesthetic)
- Add a `--spacing-*` scale utility comment block for reference (4/8/12/16/24/32)
- Adjust `--border` to be lighter/subtler in both light and dark modes
- Add smooth transitions globally: `* { transition: background-color 0.15s, border-color 0.15s, box-shadow 0.15s; }` (scoped to interactive elements)
- Remove `src/App.css` legacy styles (`.logo`, `.card`, `.read-the-docs` are unused Vite starter boilerplate)

**Files:** `src/index.css`, `src/App.css` (delete contents or file)

---

## Phase 2: Component Library Polish

Enhance existing shadcn/ui primitives to match the new aesthetic. No new components needed -- the library already exists; we refine it.

**Button (`src/components/ui/button.tsx`):**
- Add subtle `transition-all duration-150` and `shadow-xs hover:shadow-sm` to default variant
- Add `active:scale-[0.98]` for tactile press feedback

**Card (`src/components/ui/card.tsx`):**
- Change default from `shadow-sm` to `shadow-xs border-border/60` for a flatter, cleaner look
- Add hover variant utility class: `hover:shadow-md hover:border-border transition-all`

**Input (`src/components/ui/input.tsx`):**
- Add `transition-colors duration-150` for smoother focus transitions
- Increase focus ring subtlety: `focus-visible:ring-1` instead of `ring-2`

**Table (`src/components/ui/table.tsx`):**
- Add `hover:bg-muted/50 transition-colors` to `TableRow`
- Tighten header styling: `text-xs uppercase tracking-wider font-semibold text-muted-foreground`

**Skeleton (`src/components/ui/skeleton.tsx`):**
- Already exists; no changes needed

**New: EmptyState component (`src/components/ui/empty-state.tsx`):**
- Simple reusable component: icon + title + description + optional action button
- Used when tables/lists have zero results

---

## Phase 3: App Shell Redesign

Refine the existing sidebar + header layout in `AppLayout.tsx` and `AppSidebar.tsx`.

**Header (`AppLayout.tsx`):**
- Reduce height from `h-14` to `h-12` for compactness
- Add subtle bottom shadow instead of hard border: `shadow-xs` replacing `border-b`
- Clean up icon button sizing to be consistent (`h-8 w-8`)

**Sidebar (`AppSidebar.tsx`):**
- Add section dividers between nav groups using `SidebarSeparator`
- Refine active-state styling: left accent bar (`border-l-2 border-primary`) on active items
- Improve collapsed mini-mode icon alignment
- Subtle hover states: `hover:bg-accent/50 rounded-md transition-colors`

**Tab Bar (`AppTabBar.tsx`):**
- Tighten vertical padding for density
- Add subtle active indicator (bottom border accent)

---

## Phase 4: Contacts Module Redesign

Apply the polished design to the Contacts list page and detail sheet as the reference implementation for all other modules.

**Contacts Page (`src/pages/Contacts.tsx`):**
- Wrap the page header in a card-style container with consistent spacing (p-6 gap-6)
- Add a proper empty state when contacts list is empty (using new EmptyState component)
- Improve loading skeleton to show table-shaped placeholders (multiple rows)

**ContactsTable (`src/components/dashboard/ContactsTable.tsx`):**
- Apply refined table row hover states
- Add responsive behavior: on screens below `md`, render contacts as stacked cards instead of table rows
- Each card shows: name, email, phone, source badge in a compact vertical layout
- Improve pagination controls styling (consistent button sizes, clear disabled states)

**ContactDetailSheet (`src/components/dashboard/ContactDetailSheet.tsx`):**
- Refine section spacing to use the 4/8/12/16 scale consistently
- Add subtle section dividers between collapsible groups
- Improve inline-edit fields with cleaner focus/hover states
- Add smooth open/close animation to the sheet

---

## Technical Notes

- All changes are CSS/className-level only; no route, hook, or data-model changes
- The responsive table-to-cards pattern will use a simple `hidden md:table` / `md:hidden` toggle
- EmptyState is the only new file; everything else modifies existing components
- Phase 1-2 improve every screen automatically (global theme + shared components)
- Phase 3-4 are targeted layout/page refinements
- Estimated scope: ~12-15 files modified, 1 new file created

