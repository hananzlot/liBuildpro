

## Plan: Add "Project Statuses" Admin Management + Update Defaults

### What needs to change

1. **Update hardcoded default statuses** across the codebase to: `New Job`, `Awaiting Finance`, `In-Progress`, `Completed`, `Cancelled`
   - `src/components/production/AdminKPIFilters.tsx` — `PROJECT_STATUSES` and `DEFAULT_PROJECT_STATUSES`
   - `src/stores/useProductionFilters.ts` — `initialState.selectedStatuses`
   - `src/components/production/analytics/ProfitabilityTab.tsx` — `DEFAULT_STATUSES`
   - `src/components/production/analytics/ProjectSummaryTab.tsx` — default useState
   - `src/pages/FinancialStatements.tsx` — default useState

2. **Make status filter options dynamic** — Instead of hardcoded `PROJECT_STATUSES`, the Production page and AdminKPIFilters should fetch statuses from the `project_statuses` table for the current company and merge with the hardcoded fallbacks.

3. **Add a "Project Statuses" management section to Admin Settings** — A new card/section (likely under the General tab) where admins can:
   - View all statuses for their company
   - Add new statuses
   - Edit existing status names
   - Delete statuses (with confirmation)
   - Reorder statuses via sort_order

### Files to modify
- `src/components/production/AdminKPIFilters.tsx` — Update constants, optionally accept dynamic statuses
- `src/stores/useProductionFilters.ts` — Update default selectedStatuses
- `src/components/production/analytics/ProfitabilityTab.tsx` — Update DEFAULT_STATUSES
- `src/components/production/analytics/ProjectSummaryTab.tsx` — Update default
- `src/pages/FinancialStatements.tsx` — Update default
- `src/pages/AdminSettings.tsx` — Add Project Statuses management section

### Files to create
- `src/components/admin/ProjectStatusesManager.tsx` — New component for CRUD management of project statuses (add, edit, delete, reorder)

### Technical details
- The `project_statuses` table already exists with columns: `id`, `company_id`, `name`, `sort_order`, `is_default`, `created_by`, `created_at`, `updated_at`
- RLS policies were already updated to allow admin roles
- The `ProjectDetailSheet` already has inline "Add New" status capability — the new admin section provides a centralized management experience
- Dynamic status fetching will use `useQuery` with the company's `project_statuses` table, falling back to the hardcoded defaults when no DB records exist

