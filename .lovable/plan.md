
# Fix Clone Function: Nullify Stale GHL ID Fields

## Problem
The `replicate-company-data` edge function correctly remaps UUID-based references (`contact_uuid`, `opportunity_uuid`) but leaves the legacy GHL ID fields (`contact_id`, `opportunity_id`) intact. These stale IDs point to records in the source company (CA Pro Builders), causing "missing ID" errors and cross-company data leakage when edge functions fall back to GHL ID lookups.

## Scope of Stale Data in Demo Co #1
| Table | Stale Field(s) | Affected Records |
|-------|----------------|-----------------|
| opportunities | `contact_id` | 1,176 |
| projects | `contact_id`, `opportunity_id` | 37 |
| estimates | `contact_id` | 31 |
| appointments | `contact_id` | 19 |
| ghl_tasks | `contact_id` | 4 |

## Changes

### 1. Fix the Clone Function (`supabase/functions/replicate-company-data/index.ts`)
Add `contact_id: null` to the mapped output for all entity tables that carry it:
- **Opportunities** (line ~298): add `contact_id: null`
- **Appointments** (line ~314): add `contact_id: null`
- **Projects** (line ~334): add `contact_id: null, opportunity_id: null`
- Add `contact_id: null` to the estimates and ghl_tasks clone blocks as well (need to locate those sections)

This ensures future clones produce clean data with no cross-company GHL ID references.

### 2. Clean Up Existing Stale Data (SQL Migration)
Run a single migration to nullify all stale GHL ID fields in Demo Co #1:

```text
UPDATE opportunities SET contact_id = NULL WHERE company_id = 'demo-co-1-id';
UPDATE appointments SET contact_id = NULL WHERE company_id = 'demo-co-1-id';
UPDATE projects SET contact_id = NULL, opportunity_id = NULL WHERE company_id = 'demo-co-1-id';
UPDATE estimates SET contact_id = NULL WHERE company_id = 'demo-co-1-id';
UPDATE ghl_tasks SET contact_id = NULL WHERE company_id = 'demo-co-1-id';
```

This is safe because all these records already have valid `contact_uuid` / `opportunity_uuid` references (or were patched in previous fixes).

### What This Prevents
- "Cannot update contact: missing ID" errors
- Cross-company contact lookups via stale GHL IDs
- Any future clone operations producing the same problem
