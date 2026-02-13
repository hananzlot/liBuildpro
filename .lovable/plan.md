

# Fix Data Replication: Handle Dependencies and Clean Up Duplicates

## Current Problems

1. **Doubled data**: Demo Co #1 has 2x the records it should (2,953 contacts vs 1,475 source) because the function ran multiple times without properly clearing first.
2. **Missing tables**: `lead_sources` (2 records) was never included in the replication script.
3. **Global unique constraints**: `project_statuses` (UNIQUE on `name`) and `project_types` (UNIQUE on `name`) have global uniqueness, not per-company. Since CA Pro Builders already has records with those names, copying them for Demo Co #1 would fail.

## Fix Plan

### Step 1: Database Migration -- Fix Global Unique Constraints

Change `project_statuses` and `project_types` to use company-scoped unique constraints (same pattern we already applied to `salespeople`, `trades`, `banks`):

```sql
ALTER TABLE public.project_statuses DROP CONSTRAINT project_statuses_name_key;
ALTER TABLE public.project_statuses ADD CONSTRAINT project_statuses_name_company_key UNIQUE (name, company_id);

ALTER TABLE public.project_types DROP CONSTRAINT project_types_name_key;
ALTER TABLE public.project_types ADD CONSTRAINT project_types_name_company_key UNIQUE (name, company_id);
```

### Step 2: Update Edge Function

Add the following missing tables to the replication script:

| Table | Records | Notes |
|-------|---------|-------|
| `lead_sources` | 2 | Company-scoped unique already |
| `project_statuses` | 8 | After constraint fix |
| `project_types` | 21 | After constraint fix |

Also add these to the delete order so they get cleared properly.

### Step 3: Re-run with Clean Slate

The updated function will:
1. Clear ALL Demo Co #1 data (including the doubled records)
2. Copy `lead_sources`, `project_statuses`, `project_types` in Step 2 (config tables) before CRM core
3. Copy all other tables as before

### Expected Result

Demo Co #1 will have an exact replica with correct counts matching CA Pro Builders:
- 1,475 contacts, 1,174 opportunities, 44 projects, 28 estimates
- Plus all config: 46 settings, 10 pipeline stages, 15 salespeople, 2 lead sources, 8 project statuses, 21 project types

### Technical Details -- Files to Modify

1. **`supabase/functions/replicate-company-data/index.ts`** -- Add `lead_sources`, `project_statuses`, `project_types` to both delete and copy steps
2. **Database migration** -- Fix unique constraints on `project_statuses` and `project_types`

