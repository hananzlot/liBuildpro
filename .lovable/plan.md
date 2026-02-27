

## Plan: Archive Projects for Old Estimates and Expired Proposals

### What this does
When the Estimates page categorizes estimates as "Old" (30+ days) or proposals as "Expired" (past expiration date), the linked projects will be soft-deleted (archived) automatically. Specifically:

1. **Old Estimates** — Projects in "Estimate" status whose estimate is 30+ days old get soft-deleted
2. **Expired Proposals** — Projects in "Proposal" status whose proposal expiration date is 7+ days past get soft-deleted

### Implementation Steps

**1. Create a Supabase Edge Function `archive-stale-projects`**
- Accepts a `company_id` parameter
- Runs two UPDATE queries:
  - Sets `deleted_at = now()` on projects where `project_status = 'Estimate'` and the linked estimate's `estimate_date` is older than 30 days
  - Sets `deleted_at = now()` on projects where `project_status = 'Proposal'` and the linked estimate's `expiration_date` is more than 7 days past
- Returns count of archived projects for each category

**2. Trigger the edge function from the Estimates page**
- In `src/pages/Estimates.tsx`, call the edge function once on page load (or on a manual "Archive" action) so that stale projects get cleaned up whenever a user visits the Estimates page
- Use a `useEffect` or mutation that fires after the estimates query loads, calling `supabase.functions.invoke('archive-stale-projects', { body: { company_id } })`
- After the function completes, invalidate the production/projects query cache so the Production board reflects the changes

**3. Alternative: Direct Supabase RPC approach (simpler)**
- Instead of an edge function, create a database function `archive_stale_projects(p_company_id uuid)` via migration that:
  ```sql
  -- Archive projects linked to old estimates (30+ days)
  UPDATE projects p
  SET deleted_at = now()
  FROM estimates e
  WHERE e.project_id = p.id
    AND p.company_id = p_company_id
    AND p.project_status = 'Estimate'
    AND p.deleted_at IS NULL
    AND e.estimate_date < now() - interval '30 days';

  -- Archive projects linked to expired proposals (7+ days past expiration)
  UPDATE projects p
  SET deleted_at = now()
  FROM estimates e
  WHERE e.project_id = p.id
    AND p.company_id = p_company_id
    AND p.project_status = 'Proposal'
    AND p.deleted_at IS NULL
    AND e.expiration_date IS NOT NULL
    AND e.expiration_date < now() - interval '7 days';
  ```
- Call via `supabase.rpc('archive_stale_projects', { p_company_id: companyId })` from the Estimates page on load

**Recommended approach**: The RPC function (option 3) is simpler and faster — no edge function deployment needed, runs server-side with proper security via `SECURITY DEFINER`, and can be called directly from the frontend.

### Files to create/modify
- **New migration**: Create `archive_stale_projects` database function
- **`src/pages/Estimates.tsx`**: Add `useEffect` to call the RPC on page load, invalidate project caches after

