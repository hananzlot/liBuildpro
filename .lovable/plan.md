

## Plan: In-Progress Project Summary Report

### What Gets Built

A new **"Project Summary"** analytics tab showing all in-progress projects with a financial snapshot: contract value, invoiced, collected, outstanding AR, bills, bills paid, outstanding AP, net cash, and expandable rows showing payment phase details.

### Changes

**1. Register the report in the permissions system** (`src/hooks/useAnalyticsPermissions.ts`)
- Add `{ key: "project_summary", label: "Project Summary", route: "/analytics/project_summary" }` to `ANALYTICS_REPORTS`
- Add `"project_summary"` to `ADMIN_DEFAULT_REPORTS`

**2. Update `RoleAnalyticsDefaults`** — no code change needed; it dynamically reads from `ANALYTICS_REPORTS`, so the new report will appear automatically in the role-defaults matrix.

**3. Set production role default** — The admin role-defaults UI lets you toggle this on. However, to make it enabled for production by default out of the box, the initial empty-state logic in `useAnalyticsPermissions` will treat `project_summary` as included for the `production` role when no company setting has been saved yet (a sensible code-level default).

**4. Create `ProjectSummaryTab.tsx`** (`src/components/production/analytics/ProjectSummaryTab.tsx`)
- Standalone component with its own data fetching (separate from `useProductionAnalytics` to keep it clean)
- Fetches in-progress projects with joined data:
  - `projects` (status = In-Progress)
  - `project_agreements` → contract totals
  - `project_invoices` → invoiced amounts
  - `project_payments` → collected amounts (Received, not voided)
  - `project_bills` → bill amounts (not voided)
  - `bill_payments` → bills paid
  - `project_payment_phases` → phase breakdown
- **KPI cards** at top: Total Contract Value, Total Invoiced, Total Collected, Outstanding AR, Outstanding AP
- **Table columns**: Project #, Customer, Contract Amount, Total Invoiced, Total Collected, Outstanding AR, Total Bills, Bills Paid, Outstanding AP, Net Cash
- **Expandable rows**: Click a project row to see its payment phases with phase name, phase amount, invoiced against phase, collected against phase, and a status badge (Paid / Partial / Pending)
- **Totals footer row** with grand totals
- Sortable columns, matching existing table styling

**5. Wire into `AnalyticsSection.tsx`**
- Add `canViewProjectSummary` check from `visibleReports`
- Add to `permittedTabs` array
- Add tab trigger with icon (e.g., `ClipboardList`)
- Add `TabsContent` rendering `ProjectSummaryTab`
- Add CSV export case for `project_summary` in `handleExport`

**6. No database changes needed** — all data already exists in the current schema.

### Technical Notes
- The new tab fetches its own data independently to avoid bloating the existing `useProductionAnalytics` hook
- Payment phase invoicing is determined by matching `project_invoices.payment_phase_id` to `project_payment_phases.id`
- Phase collection is determined by matching `project_payments` linked to invoices linked to phases
- The report key `project_summary` follows the same pattern as existing reports and will automatically appear in the admin role-defaults configuration matrix

