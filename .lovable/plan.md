
# Fix: Opp 1131 Showing Two Projects from Different Companies

## Root Cause

The database query at line 413-417 of `OpportunityDetailSheet.tsx` fetches projects by `opportunity_id` only, without filtering by `company_id`:

```typescript
const { data: projectsData } = await supabase
  .from("projects")
  .select("id, project_name")
  .eq("opportunity_id", opportunity.ghl_id)  // <-- missing company_id filter!
  .order("created_at", { ascending: false });
```

The database has two projects with the same `opportunity_id = local_opp_1769448001459_4kfq3x2`:

- `089e0993...` — belongs to **CA Pro Builders** (the correct company)
- `7f307630...` — belongs to **Demo Co #1** (a different company, likely created when data was replicated)

Without the `company_id` filter, both projects are returned and the dropdown shows two entries even though only one belongs to the current company.

## The Fix

One line added to `src/components/dashboard/OpportunityDetailSheet.tsx` at line 416:

```typescript
// Before
const { data: projectsData } = await supabase
  .from("projects")
  .select("id, project_name")
  .eq("opportunity_id", opportunity.ghl_id)
  .order("created_at", { ascending: false });

// After
const { data: projectsData } = await supabase
  .from("projects")
  .select("id, project_name")
  .eq("opportunity_id", opportunity.ghl_id)
  .eq("company_id", companyId)              // <-- add this
  .order("created_at", { ascending: false });
```

This ensures only projects belonging to the currently selected company are shown, so opp 1131 will correctly show just one "Project" button (not a dropdown).

## Files Changed

- `src/components/dashboard/OpportunityDetailSheet.tsx` — add `.eq("company_id", companyId)` to the project fetch query only

## No Database Changes Required

This is a pure frontend query fix.
