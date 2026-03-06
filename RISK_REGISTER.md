# iBuildPro Risk Register

**Date:** 2026-03-06
**Auditor:** Claude Code (Opus 4.6)

---

## Risk Severity Definitions

| Level | Definition |
|-------|-----------|
| **CRITICAL** | Immediate exploitation possible. Data breach, financial loss, or legal liability. Fix within days. |
| **HIGH** | Significant vulnerability or architectural flaw. Fix within 1-2 weeks. |
| **MEDIUM** | Notable concern that compounds over time. Fix within 1 month. |
| **LOW** | Minor issue, best practice violation. Fix opportunistically. |
| **INFO** | Observation for awareness. No immediate action needed. |

---

## CRITICAL Risks

### RISK-001: Overly Permissive RLS Policies -- Cross-Tenant Data Exposure
- **Category:** Security
- **Status:** CONFIRMED
- **Description:** 15+ core business tables have `FOR ALL USING (true) WITH CHECK (true)` RLS policies. Any user with the Supabase anon key (publicly available in the client bundle) can read, insert, update, and delete ANY record across ALL tenants.
- **Affected Tables:** `projects`, `project_finance`, `project_agreements`, `project_invoices`, `project_payments`, `project_bills`, `project_commissions`, `project_checklists`, `project_messages`, `project_feedback`, `project_cases`, `opportunities`, `appointments`, `contacts`, `ghl_users`, `call_logs`, `bill_payments`, `project_documents`
- **Evidence:** Migration files creating policies with `USING (true)`
- **Impact:** Complete data breach of all tenant data. Any person with the anon key can access all customer records, financial data, and project information.
- **Recommendation:** Replace all `USING (true)` policies with company-scoped policies: `USING (company_id = get_user_company_id())`. Requires database snapshot before deployment.

### RISK-002: company_settings Table Publicly Readable
- **Category:** Security
- **Status:** CONFIRMED
- **Description:** The `company_settings` table has a `SELECT USING (true)` policy. This table stores Twilio Account SIDs, Auth Tokens, and phone numbers.
- **Evidence:** RLS policy in migration `20260120033256`
- **Impact:** Any user can read Twilio credentials for all companies, enabling unauthorized SMS sending, call interception, and billing abuse.
- **Recommendation:** Restrict `company_settings` SELECT to authenticated users within the same company. Move sensitive credentials to `company_integrations` table with encryption.

### RISK-003: Edge Functions Without Authentication
- **Category:** Security
- **Status:** CONFIRMED
- **Description:** Three edge functions accept requests with zero authentication:
  - `sign-document` -- Anyone can forge document signatures given a document ID
  - `store-resend-key` -- Anyone can overwrite a company's email API key
  - `quickbooks-auth` -- Anyone can access/disconnect QuickBooks integrations for any company
- **Evidence:**
  - `supabase/functions/sign-document/index.ts` (no auth header check)
  - `supabase/functions/store-resend-key/index.ts` (no auth header check)
  - `supabase/functions/quickbooks-auth/index.ts` (no auth header check)
- **Impact:**
  - Document signature forgery (legal liability)
  - Email interception via malicious Resend key injection
  - Financial data exposure via QuickBooks access
- **Recommendation:** Add auth header validation + role/company checks to all three functions.

---

## HIGH Risks

### RISK-004: Hardcoded Client-Side Deletion Password
- **Category:** Security
- **Status:** CONFIRMED
- **Description:** Two components use a hardcoded password `"121867"` as a gate for bulk deletion operations. This password is visible in the JavaScript bundle.
- **Evidence:**
  - `src/components/dashboard/AddressNameDuplicatesCleanup.tsx:73`
  - `src/components/dashboard/DuplicateOpportunitiesCleanup.tsx:74`
- **Impact:** Any user can bypass the deletion gate by reading the source code, enabling unauthorized bulk data deletion.
- **Recommendation:** Move deletion authorization to a server-side edge function with proper admin role verification.

### RISK-005: Zero Code Splitting
- **Category:** Performance
- **Status:** CONFIRMED
- **Description:** All 47 page components are statically imported in `AppRoutes.tsx`. Heavy libraries (Fabric.js ~800KB, pdfjs-dist ~1.5MB, Recharts ~400KB, html2canvas ~200KB) are included in the initial bundle.
- **Evidence:** `src/components/routing/AppRoutes.tsx` (lines 1-48, all static imports)
- **Impact:** Estimated initial bundle size of 3-5MB. Slow first-load time, especially on mobile/low-bandwidth connections.
- **Recommendation:** Implement `React.lazy()` with `Suspense` for route-level code splitting. Priority: SuperAdmin, Documents/PDF, Analytics, Portal, Deck.

### RISK-006: FinanceSection.tsx Monolith (9,038 Lines)
- **Category:** Performance / Maintainability
- **Status:** CONFIRMED
- **Description:** Single component file with 108 `useState` hooks, 54 `useQuery`/`useMutation` hooks, 8 real-time subscriptions, and 19 direct Supabase calls. Any state change re-renders the entire 9,000-line component tree.
- **Evidence:** `src/components/production/FinanceSection.tsx`
- **Impact:** Severe render performance issues. Unmaintainable. High risk of regressions. Lovable cannot safely edit this file.
- **Recommendation:** Decompose into InvoicesTab, BillsTab, AgreementsTab, CommissionsTab, PhasesTab, and ProfitabilityDialog sub-components.

### RISK-007: Production Page Loads All Data Into Memory
- **Category:** Scalability
- **Status:** CONFIRMED
- **Description:** `Production.tsx` fetches ALL financial records (agreements, phases, invoices, payments, bills, bill payments, commission payments, checklists) for the entire company, then cross-joins them client-side using O(n*m) forEach+filter loops.
- **Evidence:** `src/pages/Production.tsx` (lines 387-553)
- **Impact:** Will degrade linearly as data grows. At 500+ projects with thousands of financial records, the page will become unusable.
- **Recommendation:** Create a Supabase database function or view that performs the aggregation server-side. Implement virtual scrolling for the table.

### RISK-008: TypeScript Strict Mode Disabled
- **Category:** Maintainability
- **Status:** CONFIRMED
- **Description:** `tsconfig.app.json` has `strict: false`, `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false`. This hides null safety violations, unused code, and type errors.
- **Evidence:** `tsconfig.app.json`
- **Impact:** ~100 `as any` assertions, 78 non-null assertions, unknown number of implicit `any` types. Increases bug risk and makes refactoring dangerous.
- **Recommendation:** Enable strict mode incrementally, starting with `strictNullChecks` on new files.

### RISK-009: formatCurrency Duplicated 35 Times
- **Category:** Maintainability
- **Status:** CONFIRMED
- **Description:** A canonical `formatCurrency` exists in `src/lib/utils.ts` and is imported by ~34 components. But 35 additional components define their own local copy.
- **Evidence:** See code quality audit for full list of 35 files
- **Impact:** Inconsistent currency formatting. Changes to the shared version don't propagate. Increases bundle size.
- **Recommendation:** Delete all local copies and import from `@/lib/utils`. Single search-and-replace operation.

### RISK-010: Missing project_id Indexes on 6 Financial Tables
- **Category:** Performance
- **Status:** CONFIRMED
- **Description:** Tables `project_invoices`, `project_payments`, `project_bills`, `project_agreements`, `project_payment_phases`, and `project_checklists` lack indexes on the `project_id` column, which is the primary query filter.
- **Evidence:** No `CREATE INDEX` on `project_id` found in any migration file for these tables
- **Impact:** Per-project queries in FinanceSection.tsx and Production.tsx may perform full table scans. Impact grows linearly with data.
- **Recommendation:** Add `CREATE INDEX` on `project_id` for all 6 tables. Low-risk migration, can be done without downtime.

### RISK-011: Cross-Company IDOR in send-sms
- **Category:** Security
- **Status:** CONFIRMED
- **Description:** The `send-sms` edge function accepts `companyId` from the request body without verifying the authenticated user belongs to that company.
- **Evidence:** `supabase/functions/send-sms/index.ts` (line 46)
- **Impact:** Any authenticated user can send SMS using any company's Twilio credentials.
- **Recommendation:** Derive `companyId` from the authenticated user's profile instead of accepting it from the request body.

---

## MEDIUM Risks

### RISK-012: Wildcard CORS on All Edge Functions
- **Category:** Security
- **Status:** CONFIRMED
- **Description:** Every edge function sets `Access-Control-Allow-Origin: *`, allowing any website to make cross-origin requests.
- **Evidence:** All edge function `index.ts` files
- **Impact:** Weakens defense-in-depth against token theft/CSRF attacks.
- **Recommendation:** Set CORS origin to the actual application domain(s).

### RISK-013: Twilio Webhook Without Signature Verification
- **Category:** Security
- **Status:** CONFIRMED
- **Description:** `twilio-sms-webhook` does not verify the Twilio request signature, allowing forged SMS messages.
- **Evidence:** `supabase/functions/twilio-sms-webhook/index.ts`
- **Impact:** Attackers could inject fake customer messages into the portal chat system.
- **Recommendation:** Add Twilio signature verification using the `X-Twilio-Signature` header.

### RISK-014: Salesperson Portal Tokens Never Expire
- **Category:** Security
- **Status:** CONFIRMED
- **Description:** `salesperson_portal_tokens.expires_at` defaults to `NULL` (no expiration).
- **Evidence:** Migration `20260125045710` (line 8)
- **Impact:** Compromised tokens remain valid indefinitely.
- **Recommendation:** Add default 90-day expiration. Add token rotation on each use.

### RISK-015: No Server-Side File Upload Validation
- **Category:** Security
- **Status:** CONFIRMED
- **Description:** File uploads are validated for size and type only on the client side. No storage bucket policies restrict file types.
- **Evidence:** `src/components/production/FileUpload.tsx`, `src/components/salesperson-portal/PortalFileUploadSection.tsx`
- **Impact:** Malicious files (executables, scripts) could be uploaded to storage buckets.
- **Recommendation:** Configure Supabase storage policies for allowed MIME types. Add server-side content-type verification.

### RISK-016: Public Storage Bucket URLs
- **Category:** Security
- **Status:** CONFIRMED
- **Description:** Uploaded files use `getPublicUrl()`, making them accessible to anyone with the URL.
- **Evidence:** `src/components/production/FileUpload.tsx` (line 55-57)
- **Impact:** Sensitive project documents (contracts, photos, invoices) accessible without authentication.
- **Recommendation:** Use signed URLs with expiration instead of public URLs.

### RISK-017: No Default staleTime in QueryClient
- **Category:** Performance
- **Status:** CONFIRMED
- **Description:** React Query's global `staleTime` defaults to 0, causing every component mount to trigger a refetch despite 24h IndexedDB persistence.
- **Evidence:** `src/App.tsx` (lines 21-28, no `staleTime` in defaultOptions)
- **Impact:** Excessive API calls. User sees flash of stale data on every navigation.
- **Recommendation:** Set default `staleTime: 30_000` (30 seconds) or `120_000` (2 minutes) globally.

### RISK-018: FollowUpManagement.tsx -- Unmemoized O(n*m) Computations
- **Category:** Performance
- **Status:** CONFIRMED
- **Description:** Multiple filter chains with O(opportunities * contacts) complexity execute on every render without `useMemo`.
- **Evidence:** `src/components/dashboard/FollowUpManagement.tsx` (lines 982-1545)
- **Impact:** Performance degrades quadratically with data growth. Visible jank on pages with 200+ opportunities.
- **Recommendation:** Wrap all computed lists in `useMemo` with proper dependency arrays.

### RISK-019: select("*") Over-fetching (128 Occurrences)
- **Category:** Performance
- **Status:** CONFIRMED
- **Description:** 128 Supabase queries use `select("*")` instead of specifying needed columns.
- **Evidence:** 56 files across the codebase
- **Impact:** Transfers unnecessary data over the network. Increases memory usage. Exposes columns that shouldn't be sent to the client.
- **Recommendation:** Replace with explicit column lists, especially for large tables.

### RISK-020: EstimateBuilderDialog.tsx -- Potential Subscription Leak
- **Category:** Performance
- **Status:** HYPOTHESIS (likely but not confirmed at runtime)
- **Description:** Real-time subscriptions created during AI generation are cleaned up via a manual `cleanupGeneration()` function, not via `useEffect` cleanup. If the component unmounts during generation, subscriptions may leak.
- **Evidence:** `src/components/estimates/EstimateBuilderDialog.tsx` (lines 1696-1697, 1762, 1834)
- **Impact:** Orphaned real-time connections consuming server resources.
- **Recommendation:** Move subscription management into a `useEffect` with proper cleanup return.

### RISK-021: 7.2MB Unoptimized Deck Images
- **Category:** Performance
- **Status:** CONFIRMED
- **Description:** 17 PNG screenshots totaling 7.2MB are statically imported into the bundle for the marketing deck page.
- **Evidence:** `src/assets/deck/` directory
- **Impact:** Increases bundle size significantly for a rarely-used feature.
- **Recommendation:** Convert to WebP (70-80% reduction). Lazy-load. Move to Supabase Storage or CDN.

---

## LOW Risks

### RISK-022: 92 console.log Statements in Production Code
- **Category:** Quality
- **Status:** CONFIRMED
- **Description:** Debug logging left in production code across 20+ files.
- **Evidence:** Highest density in `EstimateBuilderDialog.tsx` (20), `PortalProposals.tsx` (12), `PortalEstimateView.tsx` (9)
- **Impact:** Information leakage in browser console. Minor performance impact.
- **Recommendation:** Remove or replace with conditional debug logging.

### RISK-023: 14 Unused UI Components
- **Category:** Quality
- **Status:** CONFIRMED
- **Description:** shadcn/ui components installed but never imported: `aspect-ratio`, `breadcrumb`, `carousel`, `chart`, `context-menu`, `details-drawer`, `drawer`, `filter-bar`, `form`, `hover-card`, `input-otp`, `menubar`, `navigation-menu`, `pagination`
- **Impact:** Bundle size bloat (minor since tree-shaking handles most cases, but dead code in repo).
- **Recommendation:** Remove unused component files.

### RISK-024: 4 Unused Hooks
- **Category:** Quality
- **Status:** CONFIRMED
- **Description:** Hooks defined but never imported: `useArchivedSources`, `useLocationFilter`, `useModalQueryState`, `useProjectStatuses`
- **Impact:** Dead code in repository.
- **Recommendation:** Remove if not planned for future use.

### RISK-025: No Forced Password Change After Admin-Set Password
- **Category:** Security
- **Status:** CONFIRMED
- **Description:** `user_metadata.requires_password_change` is set but never enforced.
- **Evidence:** `supabase/functions/send-company-invite/index.ts`
- **Impact:** Users may continue using admin-set temporary passwords indefinitely.
- **Recommendation:** Add a check in `AuthContext` that redirects to password change if metadata flag is set.

### RISK-026: Salesperson Portal Tokens Allow Public UPDATE
- **Category:** Security
- **Status:** CONFIRMED
- **Description:** RLS policy allows anyone to UPDATE active salesperson tokens (designed for access_count tracking).
- **Evidence:** Migration `20260125045710` (line 42-43)
- **Impact:** Could be abused to modify token fields beyond `access_count`.
- **Recommendation:** Restrict UPDATE policy to only the `access_count` and `last_accessed_at` columns.

---

## INFO Observations

### OBS-001: Admin Role Simulation is Client-Side Only
- Not a security risk since RLS enforces real permissions server-side, but could confuse users if simulated role shows data that real role cannot access via API.

### OBS-002: Mixed .then() and async/await Patterns
- 17 `.then()` usages vs 1,011 `async/await`. Inconsistent but not impactful.

### OBS-003: Zero TODO/FIXME Comments
- Either very disciplined or technical debt is not being tracked inline. Consider adopting inline TODO tracking.

### OBS-004: Supabase Anon Key in .env
- Expected for VITE_ prefixed variables. Not a vulnerability -- security depends on RLS policies (which are currently broken, see RISK-001).

### OBS-005: 207KB Favicon
- Should be under 10KB. Convert to optimized ICO/PNG.
