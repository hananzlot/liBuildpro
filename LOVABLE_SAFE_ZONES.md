# iBuildPro -- Lovable Safe Zones

**Date:** 2026-03-06
**Auditor:** Claude Code (Opus 4.6)

---

## Purpose

This document defines the precise boundary between files that are safe to continue editing in Lovable and files that should only be modified through Claude Code (or manual engineering). The goal is to prevent Lovable from overwriting security fixes, performance optimizations, and structural refactors.

---

## Lovable-Safe Zones (OK to edit in Lovable)

These files follow standard patterns that Lovable generates well. Changes here are low-risk and easily reviewable.

### UI Components (Read-Write)
```
src/components/ui/*.tsx              -- All shadcn/ui components
```
**Rationale:** Standard component library. Lovable can safely add/modify these.

### Layout Components (Read-Write)
```
src/components/layout/AppSidebar.tsx
src/components/layout/Header.tsx
src/components/layout/SidebarNavContent.tsx
src/components/layout/SidebarUserSection.tsx
src/components/layout/AppLayout.tsx
src/components/layout/MobileBottomNav.tsx
src/components/layout/TopSearchBar.tsx
src/components/layout/SubNavigation.tsx
src/components/layout/PageTitle.tsx
```
**Rationale:** Standard layout patterns. Changes are visual and self-contained.

### Simple Pages (Read-Write)
```
src/pages/Auth.tsx
src/pages/Home.tsx
src/pages/NotFound.tsx
src/pages/Terms.tsx
src/pages/Privacy.tsx
src/pages/Help.tsx
src/pages/QuickbooksHelp.tsx
src/pages/ExternalBrowser.tsx
src/pages/SalesPortalGuide.tsx
```
**Rationale:** Thin pages with minimal business logic.

### Marketing/Deck (Read-Write)
```
src/components/deck/**/*
src/pages/Deck.tsx
```
**Rationale:** Static marketing content.

### Onboarding (Read-Write)
```
src/components/onboarding/**/*
src/pages/Onboarding.tsx
```
**Rationale:** Self-contained wizard with barrel exports.

### Subscription UI (Read-Write)
```
src/components/subscription/**/*
```
**Rationale:** Standard subscription/payment UI components.

### Small Admin Components (Read-Write, <300 lines)
```
src/components/admin/BanksManager.tsx
src/components/admin/LicenseManager.tsx
src/components/admin/InsuranceManager.tsx
src/components/admin/ShortLinksManager.tsx
src/components/admin/PipelineSettings.tsx
src/components/admin/ProjectStatusManager.tsx
src/components/admin/LeadSourceManager.tsx
src/components/admin/EmailTemplateEditor.tsx
```
**Rationale:** Simple CRUD forms that follow standard patterns.

### Styling (Read-Write)
```
src/index.css
tailwind.config.ts
```
**Rationale:** Design token and CSS changes are safe.

### Constants (Read-Write)
```
src/constants/**/*
```
**Rationale:** Static configuration data.

### Types (Read-Write)
```
src/types/**/*
```
**Rationale:** Type definitions don't affect runtime behavior.

---

## Claude-Code-Only Zones (DO NOT edit in Lovable)

These files contain security logic, performance-critical code, complex state management, or architectural patterns that Lovable is likely to break.

### Security-Critical Files
```
supabase/migrations/**/*              -- ALL migration files (RLS, triggers, functions)
supabase/functions/**/*               -- ALL edge functions (auth, encryption, webhooks)
supabase/config.toml                  -- Function configuration
src/contexts/AuthContext.tsx           -- Auth flow, role management, session handling
src/components/routing/RouteGuards.tsx -- Route protection logic
src/components/routing/AppRoutes.tsx   -- Route definitions + code splitting (after Phase 2)
```
**Rationale:** Lovable has demonstrated it creates `USING (true)` RLS policies and edge functions without authentication. All security-critical code must be human/Claude-Code reviewed.

### Performance-Critical Files
```
src/App.tsx                           -- QueryClient config, provider hierarchy
src/lib/queryPersister.ts             -- IndexedDB persistence logic
src/lib/supabasePagination.ts         -- Pagination utility
```
**Rationale:** Caching strategy and persistence affect the entire application.

### God Components (Post-Refactor)
After Phase 2 refactoring, these orchestrator files should be Claude-Code-only:
```
src/components/production/FinanceSection.tsx
src/components/production/finance/**/*       -- New extracted sub-components
src/components/estimates/EstimateBuilderDialog.tsx
src/components/estimates/builder/**/*        -- New extracted sub-components
src/components/dashboard/OpportunityDetailSheet.tsx
src/components/dashboard/opportunity/**/*    -- New extracted sub-components
src/pages/Production.tsx
src/components/dashboard/FollowUpManagement.tsx
```
**Rationale:** These files have complex state management and performance optimizations that Lovable would undo. Lovable tends to add more `useState` hooks rather than using extracted custom hooks.

### Data Layer Files
```
src/hooks/useGHLContacts.ts            -- 1,692 lines of GHL integration logic
src/hooks/useProductionAnalytics.ts    -- Analytics data aggregation
src/hooks/useEstimateData.ts           -- Shared estimate fetching (after Phase 2)
src/hooks/useSubscription.ts           -- Subscription state management
src/hooks/useEmailSync.ts              -- Email sync logic
src/lib/estimateValueUtils.ts          -- Estimate calculation logic
src/lib/utils.ts                       -- Shared utilities (formatCurrency, etc.)
```
**Rationale:** Business logic and data access patterns that need consistent patterns.

### Integration Code
```
src/integrations/supabase/client.ts    -- Supabase client configuration
src/integrations/supabase/types.ts     -- Generated types (regenerate via Supabase CLI only)
```
**Rationale:** Client config affects auth. Types should be regenerated from schema, not hand-edited.

### Zustand Stores
```
src/stores/**/*
```
**Rationale:** Filter state logic should follow consistent patterns.

---

## Shared Zones (Lovable CAN edit but Claude Code should review)

These files are safe for Lovable to modify for UI changes, but any logic changes should be reviewed.

### Complex Pages (UI changes OK, logic changes need review)
```
src/pages/Calendar.tsx
src/pages/AdminSettings.tsx
src/pages/Documents.tsx
src/pages/Estimates.tsx
src/pages/Opportunities.tsx
src/pages/Appointments.tsx
```

### Dashboard Components (UI changes OK, data logic changes need review)
```
src/components/dashboard/OpportunitiesTable.tsx
src/components/dashboard/AppointmentsTable.tsx
src/components/dashboard/ContactsTable.tsx
src/components/dashboard/NewEntryDialog.tsx
```

### Admin Components with Integrations (UI OK, API logic need review)
```
src/components/admin/GHLIntegrationManager.tsx
src/components/admin/QuickBooksMappingConfig.tsx
src/components/admin/GoogleCalendarManager.tsx
src/components/admin/TwilioIntegration.tsx
src/components/admin/SalespeopleManagement.tsx
```

### Portal Components (UI OK, token/auth logic need review)
```
src/components/portal/**/*
src/components/salesperson-portal/**/*
```

---

## File Patterns Summary

### Lovable Read-Write (Safe)
```
src/components/ui/**/*
src/components/layout/**/*
src/components/deck/**/*
src/components/onboarding/**/*
src/components/subscription/**/*
src/constants/**/*
src/types/**/*
src/index.css
tailwind.config.ts
src/pages/Auth.tsx
src/pages/Home.tsx
src/pages/NotFound.tsx
src/pages/Terms.tsx
src/pages/Privacy.tsx
src/pages/Help.tsx
src/pages/Deck.tsx
src/pages/Onboarding.tsx
src/pages/QuickbooksHelp.tsx
src/pages/ExternalBrowser.tsx
src/pages/SalesPortalGuide.tsx
```

### Claude Code Only (Never Lovable)
```
supabase/**/*
src/contexts/**/*
src/components/routing/**/*
src/App.tsx
src/lib/**/*
src/integrations/**/*
src/hooks/**/*
src/stores/**/*
src/components/production/FinanceSection.tsx
src/components/production/finance/**/*
src/components/estimates/EstimateBuilderDialog.tsx
src/components/estimates/builder/**/*
src/components/dashboard/OpportunityDetailSheet.tsx
src/components/dashboard/opportunity/**/*
src/components/dashboard/FollowUpManagement.tsx
src/pages/Production.tsx
```

### Shared (Lovable for UI, Claude Code review for logic)
```
src/pages/Calendar.tsx
src/pages/AdminSettings.tsx
src/pages/Documents.tsx
src/pages/Estimates.tsx
src/pages/Opportunities.tsx
src/pages/Appointments.tsx
src/components/dashboard/OpportunitiesTable.tsx
src/components/dashboard/AppointmentsTable.tsx
src/components/dashboard/ContactsTable.tsx
src/components/dashboard/NewEntryDialog.tsx
src/components/admin/GHLIntegrationManager.tsx
src/components/admin/QuickBooksMappingConfig.tsx
src/components/admin/GoogleCalendarManager.tsx
src/components/admin/TwilioIntegration.tsx
src/components/admin/SalespeopleManagement.tsx
src/components/portal/**/*
src/components/salesperson-portal/**/*
```

---

## Recommended Boundary Between Lovable Work and Claude Code Work

### Lovable Should Handle:
- **UI/UX changes** -- styling, layout, new visual components
- **New simple pages** -- static content, basic forms
- **shadcn/ui component additions** -- adding new Radix primitives
- **Design system updates** -- colors, typography, spacing
- **Copy/content changes** -- text, labels, tooltips
- **Small feature additions** -- new fields on existing forms (if no new DB logic)
- **Onboarding/marketing** -- wizard steps, deck slides

### Claude Code Should Handle:
- **ALL database changes** -- migrations, RLS policies, triggers, functions, indexes
- **ALL edge functions** -- auth logic, encryption, webhooks, integrations
- **ALL security changes** -- auth flow, route guards, token management
- **Performance optimization** -- code splitting, query optimization, memoization
- **Component decomposition** -- breaking monoliths into sub-components
- **Data layer changes** -- hooks, stores, query patterns
- **Integration logic** -- GHL, QuickBooks, Google Calendar, Twilio
- **Build configuration** -- Vite config, TypeScript config, ESLint rules
- **Shared utilities** -- lib/utils.ts, formatters, validators

### Workflow for Shared Files:
1. Lovable makes UI changes to shared-zone files
2. Before merging, Claude Code reviews the diff for unintended logic changes
3. If logic was changed, Claude Code adjusts or reverts the logic portions
4. Merge only after both UI and logic are verified

### Protecting Claude Code Work from Lovable Overwrites:
1. **After Phase 2 refactoring**, if Lovable edits a decomposed file (e.g., `FinanceSection.tsx`), review that it didn't re-monolithize the component
2. **After Phase 3 security hardening**, if Lovable generates a new migration, review that it doesn't add `USING (true)` policies
3. **Consider adding a pre-commit hook** that flags changes to Claude-Code-only files when committed via Lovable
4. **Tag Claude Code changes** in commit messages (e.g., `[claude-code]`) so they're identifiable in git history
