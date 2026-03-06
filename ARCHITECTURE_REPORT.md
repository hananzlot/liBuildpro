# iBuildPro Architecture Report

**Date:** 2026-03-06
**Auditor:** Claude Code (Opus 4.6)
**Codebase:** liBuildpro-ClaudeCodeReview
**Total Files:** ~411 (335 .tsx, 56 .ts, 18 .png, 2 .css)
**Total Lines of Code:** ~166,189 (TypeScript/TSX)
**Supabase Migrations:** 446 files (~15,219 lines SQL)
**Edge Functions:** 91

---

## A. Executive Summary

### What This Product Is

iBuildPro is a multi-tenant SaaS CRM and project management platform purpose-built for contractors and home improvement companies. It integrates deeply with GoHighLevel (GHL) for lead/pipeline management, QuickBooks for accounting, Google Calendar for scheduling, and Twilio for SMS. The platform includes client-facing portals for document signing, estimate approval, and project tracking.

### Current Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18.3 + TypeScript 5.8 + Vite 5.4 |
| UI Framework | shadcn/ui (Radix UI primitives) + Tailwind CSS 3.4 |
| State Management | Zustand (client) + TanStack React Query 5 (server) + React Context (auth/chat) |
| Routing | React Router DOM 6.30 |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions + Storage + Realtime) |
| ORM/Query | Supabase JS SDK 2.86 (no raw SQL on client) |
| PDF/Canvas | pdfjs-dist 4.0, Fabric.js 7.1, html2canvas 1.4 |
| Charts | Recharts 2.15 |
| Forms | React Hook Form 7.61 + Zod 3.25 (minimal usage) |
| Testing | Playwright (via Lovable config) |
| Deployment | Lovable platform |

### Overall Architecture Quality Score: 4/10

The application is functionally rich and covers an impressive breadth of business operations (CRM, production management, invoicing, document signing, portals, analytics, compliance). However, it suffers from critical security vulnerabilities (wide-open RLS policies, unauthenticated edge functions), severe monolithic components (9,000-line files), zero code splitting, extensive code duplication, disabled TypeScript strict mode, and missing input validation. The architecture reflects rapid feature development via Lovable with insufficient engineering discipline around security, performance, and maintainability.

### Top 10 Risks by Severity

| # | Risk | Severity | Category |
|---|------|----------|----------|
| 1 | `FOR ALL USING (true)` RLS policies on 15+ core tables expose all data to any authenticated user (or anon key holder) | **CRITICAL** | Security |
| 2 | `sign-document`, `store-resend-key`, `quickbooks-auth` edge functions have zero authentication | **CRITICAL** | Security |
| 3 | `company_settings` table readable by anyone, exposing Twilio credentials | **CRITICAL** | Security |
| 4 | Hardcoded client-side deletion password `"121867"` in two components | **HIGH** | Security |
| 5 | Zero code splitting -- entire app loads in one bundle (~3-5MB estimated) | **HIGH** | Performance |
| 6 | FinanceSection.tsx is 9,038 lines with 108 useState hooks -- any state change rerenders everything | **HIGH** | Performance |
| 7 | Production.tsx loads ALL financial records into browser memory and joins client-side | **HIGH** | Scalability |
| 8 | TypeScript strict mode completely disabled -- hides null safety, unused code, and type errors | **HIGH** | Maintainability |
| 9 | `formatCurrency` duplicated 35 times despite existing shared utility | **HIGH** | Maintainability |
| 10 | Missing `project_id` indexes on 6 financial tables causing potential full table scans | **HIGH** | Performance |

---

## B. System Inventory

### Frontend Framework

- **React 18.3.1** with SWC compilation (via `@vitejs/plugin-react-swc`)
- **Vite 5.4.19** for dev server (port 8080) and production builds
- Build target: `esnext` (modern browsers only)
- Path alias: `@/` maps to `./src/`

### Routing

- **React Router DOM 6.30.1** with `BrowserRouter`
- Routes defined in `src/components/routing/AppRoutes.tsx` (481 lines)
- Route protection via `ProtectedRoute` component with role/feature gates
- UUID validation via `UUIDRouteGuard`
- Role-based default page redirect via `DefaultPageRedirect`
- **No code splitting** -- all 47 page components statically imported

### State Management

| Concern | Solution | Location |
|---------|----------|----------|
| Server state | TanStack React Query 5.83 | Global QueryClient in `App.tsx` |
| Persistence | IndexedDB via `idb-keyval` | `src/lib/queryPersister.ts` |
| Auth state | React Context | `src/contexts/AuthContext.tsx` |
| Chat state | React Context | `src/contexts/PortalChatContext.tsx` |
| Tab state | React Context | `src/contexts/AppTabsContext.tsx` |
| Filter state | Zustand stores (6 stores) | `src/stores/` |
| Form state | React Hook Form | Per-component |

### UI Libraries

- **27 Radix UI primitives** wrapped via shadcn/ui in `src/components/ui/` (60+ files)
- **Tailwind CSS 3.4** with HSL CSS variable design tokens, dark mode (class-based)
- **Lucide React** for icons
- **Recharts** for charts/analytics
- **Embla Carousel** for carousels
- **Vaul** for drawer component
- **Sonner** for toast notifications
- **cmdk** for command menu
- **react-day-picker** for date picking
- **react-resizable-panels** for resizable layouts

### Backend/Runtime Structure

- **Supabase** is the sole backend -- no custom server
- **91 Edge Functions** (Deno runtime) handle business logic requiring service role access
- All edge functions have `verify_jwt = false` in `config.toml` (JWT verification delegated to function code)
- Shared utilities in `supabase/functions/_shared/` (logger, GHL credentials, field mappings, Resend key, short links)

### Database Provider and Schema Overview

- **PostgreSQL** via Supabase
- **113 tables** across these domains:
  - CRM: contacts, opportunities, appointments, tasks, lead sources
  - Projects: projects, finance, invoices, payments, bills, commissions, agreements, checklists
  - Estimates: estimates, line items, groups, drafts, signatures, portal tokens
  - Documents: document signatures, signers, fields, templates
  - Portals: client portal tokens, salesperson portal tokens, chat messages, view logs
  - Integrations: GHL (users, calendars, pipelines, field mappings), QuickBooks (connections, mappings, sync logs), Google Calendar
  - Users: profiles, user roles, user companies, analytics permissions
  - Companies: companies, settings, subscriptions, email domains, integrations, encryption keys
  - System: app settings, notifications, audit logs, short links, subscription plans

### Auth Model

- **Supabase Auth** with email/password sign-in
- Session stored in `localStorage` with auto-refresh
- Roles: `super_admin`, `admin`, `user` (stored in `user_roles` table)
- Feature roles: `sales`, `production`, `contract_manager`, `magazine` (derived from profile/permissions)
- Admin role simulation for testing (client-side only)
- Multi-company access via `user_companies` table
- Corporation hierarchy for multi-company groups

### External Integrations

| Integration | Purpose | Auth Method |
|-------------|---------|-------------|
| GoHighLevel (GHL) | CRM sync (contacts, opportunities, appointments, tasks, pipelines) | Encrypted API key per company |
| QuickBooks | Accounting sync (invoices, bills, payments, vendors) | OAuth 2.0 tokens per company |
| Google Calendar | Calendar sync | OAuth 2.0 tokens per company |
| Twilio | SMS sending and receiving | Account SID + Auth Token per company |
| Resend | Transactional email | Encrypted API key per company |

### Deployment Assumptions

- Deployed via **Lovable platform** (Git-based deployment)
- Vite production build (`vite build`)
- Supabase hosted (project ID: `mspujwrfhbobrxhofxzv`)
- No Docker, no custom CI/CD pipeline visible
- `lovable-tagger` dev dependency for component tagging

### Environment Variables and Secrets

| Variable | Location | Risk |
|----------|----------|------|
| `VITE_SUPABASE_URL` | `.env` (client) | Public by design |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` (client) | Public by design (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge function env | Properly server-side only |
| `SUPABASE_URL` | Edge function env | Properly server-side only |
| GHL API keys | Encrypted in `company_integrations` table | Per-company encryption via pgcrypto |
| QuickBooks OAuth tokens | Encrypted in `quickbooks_connections` table | Per-company encryption |
| Resend API key | Encrypted in `company_integrations` table | Per-company encryption |
| Twilio SID/Token | `company_settings` table | **WARNING: readable via overly permissive RLS** |

### Background Jobs, Webhooks, Cron, Queues

| Type | Implementation | Location |
|------|---------------|----------|
| Webhooks | Twilio SMS webhook, QuickBooks webhook | `supabase/functions/twilio-sms-webhook/`, `quickbooks-webhook/` |
| Cron | GHL pipeline updates via `pg_cron` | SQL migration (ghl_pipelines) |
| Queue | Estimate generation queue | `estimate_generation_queue` + `estimate_generation_jobs` tables |
| Scheduled | Daily portal update emails, audit log archival, subscription expiration | Edge functions (likely triggered externally) |
| Realtime | 8 channels in FinanceSection, portal chat, analytics | Supabase Realtime subscriptions |

---

## C. Codebase Map

### Major Directories and Their Purpose

```
src/
├── assets/              # Static images (deck screenshots, logo) -- 7.4MB of PNGs
├── components/
│   ├── admin/           # 34 files -- settings, integrations, user management
│   ├── calendar/        # 1 file -- calendar-specific components
│   ├── company-settings/# 1 file -- email domain setup
│   ├── dashboard/       # 38 files -- CRM tables, detail sheets, analytics
│   ├── deck/            # 12 files -- marketing slide deck
│   ├── documents/       # 3 files -- document management UI
│   ├── estimates/       # 10 files -- estimate builder, printing, proposals
│   ├── layout/          # 9 files -- sidebar, header, app shell
│   ├── onboarding/      # 4 files -- onboarding wizard (barrel exported)
│   ├── portal/          # 22 files -- client/salesperson portal UI
│   ├── production/      # 37 files -- project management, finance, analytics
│   ├── proposals/       # 2 files -- proposal-specific components
│   ├── routing/         # 3 files -- AppRoutes, RouteGuards, UUIDRouteGuard
│   ├── salesperson-portal/ # 5 files -- salesperson-specific portal
│   ├── shared/          # 1 file -- shared components
│   ├── subscription/    # 6 files -- subscription/payment UI
│   ├── super-admin/     # 1 file -- super admin components
│   └── ui/              # 60+ files -- shadcn/ui components (14 unused)
├── constants/           # Feature flag definitions
├── contexts/            # 3 React contexts (Auth, Chat, Tabs)
├── hooks/               # 28 custom hooks (4 unused)
├── integrations/
│   └── supabase/        # Supabase client + generated types (7,378 lines)
├── lib/                 # 4 utility files (utils, pagination, query persister, estimate calc)
├── pages/               # 43 page components + 8 super-admin pages
├── stores/              # 6 Zustand filter stores + 1 editor store
└── types/               # 3 type definition files (GHL, subscription, pdfjs)

supabase/
├── config.toml          # Supabase project config (91 function definitions)
├── functions/           # 91 edge functions + _shared/ utilities
└── migrations/          # 446 SQL migration files
```

### Module Boundaries

The codebase has **weak module boundaries**. Key issues:

1. **No data access layer** -- Components directly call `supabase.from()` (80+ calls to `company_settings` alone)
2. **No service layer** -- Business logic is embedded in components and edge functions
3. **Hooks partially serve as a data layer** (`useGHLContacts` at 1,692 lines) but inconsistently
4. **Components cross-reference freely** -- dashboard components import production types, etc.

### Repeated Patterns and Inconsistencies

**Repeated Patterns (Should Be Abstracted):**
- `formatCurrency` defined locally in 35 files (exists in `lib/utils.ts`)
- `formatDate`/`formatDateTime` defined locally in 19+ files
- `formatPhoneNumber` defined locally in 5 files
- Estimate data fetch (estimate + groups + line items + payment schedule) in 5 places
- `company_settings` fetch pattern repeated 80 times
- Supabase `.from().select("*")` appears 128 times (over-fetching)

**Inconsistencies:**
- `.then()` chains (17) vs `async/await` (1,011)
- Some error handling via `try/catch` (319), some via `.catch()` (14), some via Supabase `if (error)` pattern
- Some queries specify columns; most use `select("*")`
- Some components use React Query; some do raw Supabase calls in useEffect

### Dead Code

- **14 unused UI components** in `src/components/ui/`
- **4 unused hooks** in `src/hooks/`
- **1 unused barrel export** (`src/components/ui/design-system.ts`)
- **1 unused import** (`Home` in `AppRoutes.tsx`)
- **2 commented-out code blocks**

### Overly Large Files (Top 10)

| File | Lines | Primary Concern |
|------|-------|----------------|
| `integrations/supabase/types.ts` | 7,378 | Generated -- acceptable |
| `components/production/FinanceSection.tsx` | 9,038 | 108 useState, 54 queries -- MUST split |
| `components/estimates/EstimateBuilderDialog.tsx` | 5,275 | 49 useState, complex state -- MUST split |
| `components/dashboard/OpportunityDetailSheet.tsx` | 4,521 | 122 useState, 42 Supabase calls -- MUST split |
| `pages/Production.tsx` | 3,072 | Loads all data client-side -- MUST refactor |
| `components/dashboard/FollowUpManagement.tsx` | 2,884 | 53 useState, O(n*m) loops -- MUST optimize |
| `components/production/ProjectDetailSheet.tsx` | 2,509 | 33 useState -- should split |
| `pages/AdminSettings.tsx` | 2,201 | 27 useState -- should split |
| `components/dashboard/AppointmentDetailSheet.tsx` | 2,084 | 42 useState -- should split |
| `pages/Calendar.tsx` | 1,999 | 33 useState -- should split |

### Circular Dependencies

No true circular dependencies detected. Minor architectural concern: `useProjectStatuses` hook imports from `AdminKPIFilters` component (inverted dependency -- constant should be extracted).

---

## D. Data Architecture Review

### Core Entities and Relationships

```
Corporation (1) ──── (*) Company
Company (1) ──── (*) Profile (user)
Company (1) ──── (*) Contact
Company (1) ──── (*) Opportunity ──── (*) Appointment
Company (1) ──── (*) Project
    Project (1) ──── (*) ProjectInvoice ──── (*) ProjectPayment
    Project (1) ──── (*) ProjectBill ──── (*) BillPayment
    Project (1) ──── (*) ProjectAgreement
    Project (1) ──── (*) ProjectCommission
    Project (1) ──── (*) ProjectChecklist
    Project (1) ──── (*) ProjectDocument
    Project (1) ──── (*) ProjectMessage
Company (1) ──── (*) Estimate
    Estimate (1) ──── (*) EstimateGroup ──── (*) EstimateLineItem
    Estimate (1) ──── (*) EstimateSignature
    Estimate (1) ──── (*) EstimatePaymentSchedule
Company (1) ──── (*) Subcontractor
Company (1) ──── (*) Salesperson
Company (1) ──── (*) CompanyIntegration (GHL, QB, Resend)
```

### Tenant/Company Isolation

**Confirmed:** Multi-tenancy is implemented via `company_id` foreign keys on all business tables. The `get_user_company_id()` and `has_company_access()` functions are used in RLS policies.

**CRITICAL GAP:** Despite the multi-tenant design, many RLS policies use `USING (true)` which completely bypasses company isolation. The following core tables have NO effective tenant isolation at the database level:

- `projects`, `project_finance`, `project_agreements`, `project_invoices`, `project_payments`, `project_bills`, `project_commissions`, `project_checklists`, `project_messages`, `project_feedback`, `project_cases`
- `opportunities`, `appointments`, `contacts`
- `ghl_users`, `call_logs`, `bill_payments`, `project_documents`

These tables rely entirely on the frontend filtering by `company_id` for isolation, which is trivially bypassable.

### Missing Indexes

| Table | Missing Index Column | Query Pattern |
|-------|---------------------|---------------|
| `project_invoices` | `project_id` | `.eq("project_id", ...)` in FinanceSection, Production |
| `project_payments` | `project_id` | `.eq("project_id", ...)` in FinanceSection, Production |
| `project_bills` | `project_id` | `.eq("project_id", ...)` in FinanceSection, Production |
| `project_agreements` | `project_id` | `.eq("project_id", ...)` in Production |
| `project_payment_phases` | `project_id` | `.eq("project_id", ...)` in Production |
| `project_checklists` | `project_id` | `.eq("project_id", ...)` in Production |
| `bill_payments` | `bill_id` | `.eq("bill_id", ...)` in FinanceSection |

**Note:** `company_id` indexes DO exist on all tables (added in migration `20260120033256`).

### Dangerous Queries

- **Production.tsx** loads ALL financial records for entire company: 8 bulk queries (`fetchAllPages`) for agreements, phases, invoices, payments, bills, bill payments, commission payments, and checklists, then cross-joins client-side
- **BackupManagement.tsx** (super-admin) issues `select("*").limit(10000)` per table in a loop

### Weak Constraints

- `salesperson_portal_tokens.expires_at` defaults to `NULL` (never expires)
- No foreign key from `opportunities.contact_id` to `contacts.id` (uses GHL text IDs)
- Heavy use of `TEXT` columns for IDs that reference GHL entities (no referential integrity)
- Some tables lack `NOT NULL` constraints on critical fields

### Migrations, Functions, Triggers

- **446 migrations** (Dec 2025 - Mar 2026) -- rapid iteration, some are single-line fixes
- **55 database functions** covering auth, encryption, auto-assignment, data sync, financial calculations
- **75 triggers** for timestamps, audit logging, auto-assignment, data sync, business logic
- Encryption via pgcrypto for API keys and OAuth tokens (per-company encryption keys)
- Audit trail via trigger-based logging on opportunities, estimates, projects

### Database Changes Risky to Modify Through Lovable

| Change | Risk Level | Reason |
|--------|-----------|--------|
| Modifying RLS policies | HIGH | Lovable may regenerate or overwrite custom policies |
| Adding/modifying triggers | HIGH | Complex SQL logic outside Lovable's comfort zone |
| Altering encryption functions | CRITICAL | Could lock out encrypted credentials |
| Changing table schemas with data | HIGH | Requires careful migration with data backfill |
| Modifying `auth` schema hooks | HIGH | Could break authentication flow |

---

## E. Security Review

### Auth Flow

- **Sign-in:** `supabase.auth.signInWithPassword()` with email/password
- **Session:** Stored in `localStorage`, auto-refreshed by Supabase SDK
- **Roles:** Fetched from `user_roles` table post-login, cached in React Context
- **Company context:** User's `company_id` fetched from `profiles` table
- **Admin simulation:** Client-side role/user simulation for testing (does not affect server-side auth)
- **Password reset:** Via Supabase Auth built-in flow

### Authorization Enforcement Points

| Layer | Mechanism | Coverage |
|-------|-----------|----------|
| Client routing | `ProtectedRoute` component | All authenticated routes |
| Client features | Feature flags + subscription checks | UI-level gating |
| Database | RLS policies | **INCOMPLETE -- many tables use `USING (true)`** |
| Edge functions | Manual auth header + role checks | **INCONSISTENT -- some have zero auth** |
| Portal | Token-based access (cryptographically secure) | Portal routes only |

### Row-Level Security Coverage

**CRITICAL FINDING:** RLS is enabled on all tables but many policies are effectively `USING (true)` (allow all). See Risk Register for full list.

**Well-protected tables:** `profiles`, `user_roles`, `client_portal_tokens` (after fix), `portal_chat_messages`

**Unprotected tables (allow-all policies):** `projects` and all 10 sub-tables, `opportunities`, `appointments`, `contacts`, `ghl_users`, `company_settings`, `companies`, `corporations`

### Secrets Exposure Risks

| Finding | Severity | Location |
|---------|----------|----------|
| Hardcoded deletion password `"121867"` | HIGH | `AddressNameDuplicatesCleanup.tsx:73`, `DuplicateOpportunitiesCleanup.tsx:74` |
| `company_settings` readable by anyone (contains Twilio creds) | CRITICAL | RLS policy `USING (true)` on company_settings |
| Supabase anon key in `.env` | INFO | Expected for VITE_ vars |

### Unsafe Edge Functions (No Authentication)

| Function | Risk | Impact |
|----------|------|--------|
| `sign-document` | Anyone can forge document signatures | Legal document integrity |
| `store-resend-key` | Anyone can overwrite email API key | Email interception |
| `quickbooks-auth` | Anyone can access/disconnect QB integration | Financial data exposure |
| `twilio-sms-webhook` | No signature verification -- fake SMS injection | Customer communication integrity |
| `send-sms` | Authenticated but no company ownership check (IDOR) | Cross-tenant SMS abuse |

### Input Validation Gaps

- **Zod schemas:** Used only in `Auth.tsx` (login form). Zero validation on other forms.
- **29+ files** perform direct `.insert()`/`.update()` without validation
- Edge functions have minimal input validation (most only check field existence, not type/format)
- **No server-side file type validation** on uploads

### File Upload Risks

- File size limits exist (15-20MB) but are client-side only
- File type validation is client-side only (can be bypassed)
- Storage buckets use `getPublicUrl` -- uploaded files accessible without auth
- No malware scanning or content-type verification

### IDOR Patterns

- `send-sms`: accepts `companyId` from request body, doesn't verify user belongs to company
- `quickbooks-auth`: accepts `companyId` from body, no auth at all
- `store-resend-key`: accepts `companyId` from body, no auth at all
- All tables with `USING (true)` RLS are vulnerable to cross-tenant data access

---

## F. Lovable Compatibility Review

### Files/Areas Safe to Keep Editing in Lovable

| Area | Path | Rationale |
|------|------|-----------|
| UI components | `src/components/ui/*` | Standard shadcn/ui -- Lovable handles well |
| Simple pages | `src/pages/Auth.tsx`, `src/pages/Home.tsx`, `src/pages/NotFound.tsx` | Thin wrappers |
| Layout components | `src/components/layout/*` | Standard sidebar/header patterns |
| Onboarding | `src/components/onboarding/*` | Self-contained module |
| Deck/marketing | `src/components/deck/*` | Static content |
| Simple admin forms | Small files in `src/components/admin/` (<200 lines) | Standard form patterns |
| Subscription UI | `src/components/subscription/*` | Standard UI flows |
| Styling | `src/index.css`, `tailwind.config.ts` | Design token changes |

### Files/Areas That Should Be Claude-Code-Only

| Area | Path | Rationale |
|------|------|-----------|
| RLS policies | `supabase/migrations/*` | Lovable cannot reason about security policies |
| Edge functions | `supabase/functions/*` | Auth logic, encryption, webhook verification |
| Auth context | `src/contexts/AuthContext.tsx` | Complex auth flow with role simulation |
| Query persister | `src/lib/queryPersister.ts` | Performance-critical caching logic |
| Supabase pagination | `src/lib/supabasePagination.ts` | Utility with specific edge cases |
| God components (post-refactor) | `FinanceSection`, `EstimateBuilderDialog`, `OpportunityDetailSheet` | Too complex for Lovable to modify safely |
| Route guards | `src/components/routing/*` | Security-critical routing logic |

### Generated Patterns Likely to Drift or Break

1. **Supabase types** (`integrations/supabase/types.ts`) -- Will desync as migrations are added outside Lovable
2. **Route definitions** -- Adding routes in Lovable may not update guards correctly
3. **RLS policies** -- Lovable-generated migrations may create overly permissive policies (evidence: current `USING (true)` patterns)
4. **Edge function CORS** -- Lovable defaults to `Access-Control-Allow-Origin: *`
5. **Component state** -- Lovable tends to add more `useState` hooks rather than extracting to custom hooks

### Risk of Lovable Overwriting Custom Engineering Work

**HIGH RISK.** Lovable operates on the full file level. If Claude Code refactors `FinanceSection.tsx` into 6 sub-components, Lovable could:
- Overwrite the refactored files with a monolithic version on next edit
- Re-introduce removed duplicate logic
- Add back `USING (true)` RLS policies that were fixed
- Reset edge function auth checks that were hardened

**Mitigation:** Establish clear file ownership boundaries (see `LOVABLE_SAFE_ZONES.md`).

---

## G. Performance and Scalability Review

### Client-Side Bottlenecks

1. **Zero code splitting** -- All 47 pages bundled into one chunk. Libraries like Fabric.js (~800KB), pdfjs-dist (~1.5MB), Recharts (~400KB), html2canvas (~200KB) are all statically imported.
2. **7.2MB of unoptimized PNGs** in `src/assets/deck/` statically imported into bundle
3. **207KB favicon** (should be <10KB)
4. **No `React.lazy()`** usage anywhere in the codebase

### N+1 Query Risks

- **Production.tsx** avoids N+1 but replaces it with "fetch everything" -- 8 bulk queries load all financial data, then O(n*m) client-side joins
- **FollowUpManagement.tsx** performs O(opportunities * contacts) filtering on every render (not memoized)
- **BackupManagement.tsx** issues one query per table in a loop

### Heavy Renders

- **FinanceSection.tsx**: 108 `useState` hooks + 8 real-time subscriptions. Any state change or subscription event re-renders 9,038 lines of JSX.
- **OpportunityDetailSheet.tsx**: 122 `useState` hooks. State setters called from callbacks re-render the entire detail view.
- **FollowUpManagement.tsx**: Multiple O(n*m) filter chains execute on every render without `useMemo`.

### Large Component Risks

Components exceeding 2,000 lines are unmaintainable and cause:
- Full re-renders on any state change (no isolation)
- Bundle size impact (can't lazy-load sub-sections)
- Merge conflicts in team development
- Lovable confusion (can't reliably edit specific sections)

### Slow Data-Loading Paths

| Path | Issue |
|------|-------|
| `/production` | Loads all projects + all financial sub-records for entire company |
| `/follow-up` | Loads all opportunities, appointments, contacts, notes, tasks |
| `/calendar` | Loads all appointments + contacts + opportunities |
| `/analytics` | Loads all production data for analytics computation |
| `/admin/settings` | 27 useState hooks, multiple settings queries |

### Missing Caching Opportunities

- **No default `staleTime`** -- React Query defaults to `staleTime: 0`, meaning every mount refetches
- **`company_settings`** fetched 80 times across components -- should be a single cached query with long staleTime
- **Subscription/plan data** rarely changes but has no staleTime set
- **Contact data** refetched on every detail view open

### Background Job Candidates

| Operation | Currently | Should Be |
|-----------|-----------|-----------|
| Financial aggregation (P&L) | Client-side computation | Database view or function |
| Project financial totals | Client-side forEach+filter | Database aggregate query |
| Audit log archival | Edge function (manual trigger) | pg_cron scheduled job |
| Estimate PDF generation | Already queued | Good -- keep as-is |
| Portal update emails | Edge function | Could benefit from pg_cron |

---

## H. Refactor Plan

*See REFACTOR_PLAN.md for detailed phased plan.*

---

## I. Recovery and Release Safety

### What Should Be Backed Up Before Changes

1. **Full database snapshot** before any migration changes
2. **Current edge function code** before auth hardening
3. **Git branch** of current working state before any refactoring
4. **Supabase project settings** (auth config, storage policies, realtime config)
5. **Environment variables** from Supabase dashboard

### Changes Requiring DB Snapshots

| Change | Reason |
|--------|--------|
| RLS policy modifications | Could lock out users or expose data if incorrect |
| Index additions | Generally safe but could impact write performance on large tables |
| Trigger modifications | Could break auto-assignment or audit logging |
| Schema alterations | Data migration required |
| Encryption function changes | Could lock out encrypted credentials permanently |

### Changes Safe Behind Feature Branches Only

- Component decomposition (FinanceSection split)
- Code splitting additions (React.lazy)
- New shared utility functions
- UI component cleanup (remove unused)
- Console.log removal
- Query optimization (staleTime, column selection)

### Changes Requiring Staging Validation

- RLS policy hardening (MUST test with multiple user roles)
- Edge function auth additions (test all integration flows)
- Database index additions (test query performance before/after)
- Portal token expiration changes (test existing portal links)
- Real-time subscription changes (test data freshness)
