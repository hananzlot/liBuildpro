# iBuildPro Refactor Plan

**Date:** 2026-03-06
**Auditor:** Claude Code (Opus 4.6)

---

## Overview

This plan is organized into four phases, ordered by risk level and value. Each phase is designed to be independently deployable and preserves compatibility with ongoing Lovable work.

**Guiding Principles:**
- Each change is small, testable, and reversible
- Database changes always get a snapshot first
- Security fixes take absolute priority
- Performance improvements that don't change behavior are safe to ship anytime
- Component refactors use feature branches and are validated visually before merge

---

## Phase 1: Zero-Risk Cleanup

**Timeline:** 1-3 days
**Risk Level:** None -- no behavior changes, no database changes
**Can be done behind feature branch:** Yes

### 1.1 Remove Dead Code

| Action | Files | Impact |
|--------|-------|--------|
| Delete 14 unused UI components | `src/components/ui/aspect-ratio.tsx`, `breadcrumb.tsx`, `carousel.tsx`, `chart.tsx`, `context-menu.tsx`, `details-drawer.tsx`, `drawer.tsx`, `filter-bar.tsx`, `form.tsx`, `hover-card.tsx`, `input-otp.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx` | Reduces file count, cleaner repo |
| Delete 4 unused hooks | `src/hooks/useArchivedSources.ts`, `useLocationFilter.ts`, `useModalQueryState.ts`, `useProjectStatuses.ts` | Remove dead code |
| Delete unused barrel export | `src/components/ui/design-system.ts` | Remove dead code |
| Remove unused import | `src/components/routing/AppRoutes.tsx` (line 2, `Home` import) | Clean import |
| Remove 2 commented-out code blocks | `src/components/dashboard/OpportunitiesTable.tsx:160`, `src/integrations/supabase/client.ts:9` | Clean code |

### 1.2 Remove Console.log Statements

| Action | Files | Impact |
|--------|-------|--------|
| Remove 92 `console.log` statements | 20+ files (highest: `EstimateBuilderDialog.tsx` 20, `PortalProposals.tsx` 12, `PortalEstimateView.tsx` 9) | Stop information leakage in production |
| Keep `console.error` for actual error logging | All files | Preserve error visibility |

### 1.3 Consolidate Duplicate Utility Functions

| Action | Files | Impact |
|--------|-------|--------|
| Replace 35 local `formatCurrency` with import from `@/lib/utils` | 35 files (see ARCHITECTURE_REPORT.md Section C for full list) | Single source of truth |
| Extract shared `formatPhoneNumber` to `@/lib/utils` | 5 files: `EstimateBuilderDialog.tsx`, `ContactsTable.tsx`, `AppointmentDetailSheet.tsx`, `AppointmentsAnalysisDialog.tsx`, `ProjectDetailSheet.tsx` | DRY |
| Extract shared `formatDate`/`formatDateTime` to `@/lib/utils` | 19+ files | DRY |
| Extract `getPSTOffset` to `@/lib/utils` | `FollowUpManagement.tsx`, `OpportunityDetailSheet.tsx` | DRY |

### 1.4 Optimize Assets

| Action | Files | Impact |
|--------|-------|--------|
| Convert 17 deck PNGs to WebP | `src/assets/deck/*.png` (7.2MB total) | ~5MB reduction |
| Compress favicon | `public/favicon.png` (207KB) | ~190KB reduction |
| Compress logo | `src/assets/ibuildpro-logo.png` (203KB) | ~150KB reduction |

---

## Phase 2: High-Value Structural Fixes

**Timeline:** 1-2 weeks
**Risk Level:** Low-Medium -- behavioral changes contained within components
**Can be done behind feature branch:** Yes
**Requires visual validation:** Yes

### 2.1 Implement Route-Level Code Splitting

| Action | Files | Impact |
|--------|-------|--------|
| Convert all page imports to `React.lazy()` | `src/components/routing/AppRoutes.tsx` | ~50-60% initial bundle reduction |
| Add `Suspense` boundaries with loading states | `src/components/routing/AppRoutes.tsx` | Smooth loading UX |
| Priority lazy routes: SuperAdmin (8 pages), Documents/PDF (3), Analytics (1), Portal (4), Deck (1) | Same file | Largest bundle savings |

**Implementation pattern:**
```tsx
const Production = React.lazy(() => import("@/pages/Production"));
// In routes:
<Suspense fallback={<PageLoader />}>
  <Production />
</Suspense>
```

### 2.2 Set Global React Query Defaults

| Action | Files | Impact |
|--------|-------|--------|
| Add `staleTime: 60_000` to QueryClient defaults | `src/App.tsx` (line 22) | Reduce unnecessary refetches globally |
| Remove redundant `staleTime: 0` overrides | `EstimateBuilderDialog.tsx` (5 locations), `FinanceSection.tsx` (2) | Consistent caching |

### 2.3 Add Missing Database Indexes

| Action | Migration SQL | Impact |
|--------|--------------|--------|
| Add `project_id` index on `project_invoices` | `CREATE INDEX idx_project_invoices_project_id ON project_invoices(project_id);` | Faster per-project queries |
| Add `project_id` index on `project_payments` | `CREATE INDEX idx_project_payments_project_id ON project_payments(project_id);` | Faster per-project queries |
| Add `project_id` index on `project_bills` | `CREATE INDEX idx_project_bills_project_id ON project_bills(project_id);` | Faster per-project queries |
| Add `project_id` index on `project_agreements` | `CREATE INDEX idx_project_agreements_project_id ON project_agreements(project_id);` | Faster per-project queries |
| Add `project_id` index on `project_payment_phases` | `CREATE INDEX idx_project_payment_phases_project_id ON project_payment_phases(project_id);` | Faster per-project queries |
| Add `project_id` index on `project_checklists` | `CREATE INDEX idx_project_checklists_project_id ON project_checklists(project_id);` | Faster per-project queries |
| Add `bill_id` index on `bill_payments` | `CREATE INDEX idx_bill_payments_bill_id ON bill_payments(bill_id);` | Faster bill payment lookups |

**Pre-requisite:** Database snapshot before applying migration.

### 2.4 Decompose FinanceSection.tsx (9,038 lines -> ~6 files)

| New File | Extracted From | Approx Lines |
|----------|---------------|--------------|
| `components/production/finance/InvoicesTab.tsx` | Invoice CRUD + payment tracking | ~1,500 |
| `components/production/finance/BillsTab.tsx` | Bills + bill payments | ~1,500 |
| `components/production/finance/AgreementsTab.tsx` | Agreements + payment phases | ~1,200 |
| `components/production/finance/CommissionsTab.tsx` | Commission tracking | ~800 |
| `components/production/finance/ProfitabilityDialog.tsx` | P&L calculations + display | ~600 |
| `components/production/finance/useFinanceData.ts` | All useQuery/useMutation/realtime hooks | ~1,000 |
| `components/production/FinanceSection.tsx` | Orchestrator with tabs | ~500 |

**Approach:**
1. Extract data hooks first into `useFinanceData.ts`
2. Extract tab content components one at a time
3. Keep `FinanceSection.tsx` as a thin orchestrator
4. Each extraction is a separate commit for easy rollback

### 2.5 Decompose EstimateBuilderDialog.tsx (5,275 lines -> ~5 files)

| New File | Extracted From | Approx Lines |
|----------|---------------|--------------|
| `components/estimates/builder/EstimateFormFields.tsx` | Form header fields | ~800 |
| `components/estimates/builder/LineItemsEditor.tsx` | Line items + groups | ~1,200 |
| `components/estimates/builder/PaymentScheduleEditor.tsx` | Payment phases | ~600 |
| `components/estimates/builder/useEstimateBuilder.ts` | All state + mutations | ~1,200 |
| `components/estimates/EstimateBuilderDialog.tsx` | Dialog shell + orchestrator | ~500 |

### 2.6 Decompose OpportunityDetailSheet.tsx (4,521 lines -> ~5 files)

| New File | Extracted From | Approx Lines |
|----------|---------------|--------------|
| `components/dashboard/opportunity/OpportunityHeader.tsx` | Header + status | ~400 |
| `components/dashboard/opportunity/OpportunityTabs.tsx` | Tab navigation + content | ~800 |
| `components/dashboard/opportunity/OpportunityActivity.tsx` | Activity/notes/tasks | ~1,000 |
| `components/dashboard/opportunity/useOpportunityDetail.ts` | Data hooks + mutations | ~1,200 |
| `components/dashboard/OpportunityDetailSheet.tsx` | Sheet wrapper + orchestrator | ~500 |

### 2.7 Memoize FollowUpManagement Computations

| Action | Location | Impact |
|--------|----------|--------|
| Wrap `closeToSaleOpportunities` in `useMemo` | `FollowUpManagement.tsx:982` | Prevent O(n*m) on every render |
| Wrap `missingScopeOpportunities` in `useMemo` | `FollowUpManagement.tsx:1040` | Same |
| Wrap `noTasksOpportunities` in `useMemo` | `FollowUpManagement.tsx:1373` | Same |
| Wrap `needsAttentionResults` in `useMemo` | `FollowUpManagement.tsx:1498` | Same |

### 2.8 Create Shared Estimate Data Hook

| Action | Files | Impact |
|--------|-------|--------|
| Create `useEstimateData(estimateId)` hook | New: `src/hooks/useEstimateData.ts` | Single source of truth |
| Replace 5 duplicate fetch patterns | `PortalProjectInfo.tsx`, `PortalProposals.tsx`, `ContractPrintDialog.tsx`, `EstimateBuilderDialog.tsx`, `ProposalPrint.tsx` | DRY, consistent caching |

---

## Phase 3: Security Hardening

**Timeline:** 1-2 weeks
**Risk Level:** HIGH -- changes affect all data access
**REQUIRES:** Database snapshot, staging environment testing, multi-role testing
**Cannot be done behind feature branch alone:** Needs staging validation

### 3.1 Fix RLS Policies (CRITICAL)

**Pre-requisite:** Full database snapshot. Test with all user roles. Have rollback migration ready.

| Table Group | New Policy | Migration |
|------------|-----------|-----------|
| `projects` + 10 sub-tables | `USING (company_id = get_user_company_id())` for authenticated users | New migration |
| `opportunities` | `USING (location_id IN (SELECT location_id FROM company_integrations WHERE company_id = get_user_company_id()))` | New migration |
| `appointments` | Same location_id pattern | New migration |
| `contacts` | Same location_id pattern | New migration |
| `company_settings` | `USING (id = get_user_company_id())` for authenticated users | New migration |
| `companies` | `USING (id = get_user_company_id() OR id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()))` | New migration |
| Portal tables | Keep token-based policies but add company_id checks | New migration |

**Special handling:**
- Super admin role needs `OR is_super_admin()` on all policies
- Service role operations (edge functions) already bypass RLS
- Portal tokens need separate policies for unauthenticated portal access

### 3.2 Add Authentication to Edge Functions

| Function | Auth Required | Company Check |
|----------|--------------|---------------|
| `sign-document` | Portal token OR auth token | Verify token belongs to correct company |
| `store-resend-key` | Auth token + admin role | Derive company from user profile |
| `quickbooks-auth` | Auth token + admin role | Derive company from user profile |
| `send-sms` | Already authenticated | **Fix:** Derive companyId from user profile instead of request body |

### 3.3 Add Twilio Webhook Verification

| Action | File | Impact |
|--------|------|--------|
| Add Twilio signature verification | `supabase/functions/twilio-sms-webhook/index.ts` | Prevent forged SMS injection |
| Store Twilio Auth Token securely | Environment variable or encrypted in DB | Required for verification |

### 3.4 Fix CORS Headers

| Action | Files | Impact |
|--------|-------|--------|
| Replace `*` with actual application domain | All 91 edge function files | Defense-in-depth against CSRF |
| Use environment variable for allowed origin | `supabase/functions/_shared/cors.ts` (new shared utility) | Centralized CORS config |

### 3.5 Remove Hardcoded Deletion Password

| Action | Files | Impact |
|--------|-------|--------|
| Create `admin-bulk-delete` edge function with proper auth + admin role check | New edge function | Server-side authorization |
| Remove client-side password check | `AddressNameDuplicatesCleanup.tsx:73`, `DuplicateOpportunitiesCleanup.tsx:74` | Eliminate client-side security gate |

### 3.6 Add Default Salesperson Token Expiration

| Action | Migration | Impact |
|--------|-----------|--------|
| Set default `expires_at` to 90 days | `ALTER TABLE salesperson_portal_tokens ALTER COLUMN expires_at SET DEFAULT now() + interval '90 days';` | Tokens auto-expire |
| Backfill existing NULL tokens | `UPDATE salesperson_portal_tokens SET expires_at = created_at + interval '90 days' WHERE expires_at IS NULL;` | Close existing gap |

### 3.7 Storage Bucket Security

| Action | Impact |
|--------|--------|
| Switch from `getPublicUrl()` to `createSignedUrl()` with 1-hour expiration | Uploaded files require auth to access |
| Add MIME type restrictions to storage bucket policies | Prevent malicious file uploads |

---

## Phase 4: Scaling Prep

**Timeline:** 2-4 weeks
**Risk Level:** Medium -- requires architectural changes
**Can be done behind feature branch:** Partially

### 4.1 Server-Side Financial Aggregation

| Action | Implementation | Impact |
|--------|---------------|--------|
| Create `get_project_financials(p_company_id UUID)` database function | Returns pre-aggregated totals per project (invoice total, payment total, bill total, etc.) | Eliminate client-side O(n*m) joins |
| Replace 8 bulk queries in Production.tsx | Single RPC call: `supabase.rpc('get_project_financials', { p_company_id })` | 8 queries -> 1 query |
| Add virtual scrolling to Production table | Use `@tanstack/react-virtual` | Handle 1000+ rows without DOM bloat |

### 4.2 Reduce select("*") Over-Fetching

| Action | Files | Impact |
|--------|-------|--------|
| Replace 128 `select("*")` calls with explicit column lists | 56 files across codebase | Reduced payload sizes, less memory |
| Priority: high-traffic queries (company_settings, projects, opportunities) | ~40 files | Biggest impact first |

### 4.3 Enable TypeScript Strict Mode (Incremental)

| Step | Configuration | Impact |
|------|--------------|--------|
| 1. Enable `strictNullChecks` in tsconfig | `"strictNullChecks": true` | Catch null safety issues |
| 2. Fix ~200 null check errors in new code | Ongoing | Better type safety |
| 3. Enable `noImplicitAny` | `"noImplicitAny": true` | Catch untyped variables |
| 4. Enable `noUnusedLocals` + `noUnusedParameters` | tsconfig | Catch dead code |
| 5. Enable full `strict: true` | tsconfig | Complete type safety |

**Note:** This is a multi-week effort. Can be done file-by-file using `// @ts-strict-ignore` comments on files not yet ready.

### 4.4 Add Input Validation with Zod

| Action | Priority Files | Impact |
|--------|---------------|--------|
| Add Zod schemas for all form submissions | `EstimateBuilderDialog.tsx`, `FinanceSection.tsx`, `OpportunityDetailSheet.tsx`, `NewEntryDialog.tsx` | Runtime type safety |
| Add Zod validation in edge functions | `sign-document`, `create-user`, `send-sms`, `store-ghl-integration` | Server-side validation |
| Create shared schema library | New: `src/schemas/` directory | Reusable validation |

### 4.5 Implement Proper Pagination

| Action | Component | Impact |
|--------|-----------|--------|
| Add cursor-based pagination to Production table | `src/pages/Production.tsx` | Handle 1000+ projects |
| Add pagination to Opportunities table | `src/components/dashboard/OpportunitiesTable.tsx` | Handle 10,000+ opportunities |
| Add pagination to Appointments table | `src/components/dashboard/AppointmentsTable.tsx` | Handle 10,000+ appointments |
| Replace `fetchAllPages` with paginated loading | `src/lib/supabasePagination.ts` | Progressive data loading |

### 4.6 Add Vite Build Optimization

| Action | File | Impact |
|--------|------|--------|
| Add `manualChunks` for vendor splitting | `vite.config.ts` | Separate vendor bundles for better caching |
| Add chunk size warning | `vite.config.ts` | Alert on oversized bundles |
| Consider `vite-plugin-compression` for gzip/brotli | `vite.config.ts` | Smaller transfer sizes |

---

## Summary Table

| Phase | Items | Risk | Timeline | Pre-requisites |
|-------|-------|------|----------|---------------|
| 1. Zero-Risk Cleanup | 4 categories, ~80 file changes | None | 1-3 days | Git branch |
| 2. Structural Fixes | 8 work items | Low-Medium | 1-2 weeks | Git branch, visual testing |
| 3. Security Hardening | 7 work items | HIGH | 1-2 weeks | DB snapshot, staging env, multi-role testing |
| 4. Scaling Prep | 6 work items | Medium | 2-4 weeks | Phases 1-3 complete |
