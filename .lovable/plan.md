

## Diagnosis

Yes, **opportunity stage names** and **pipeline stages** are the same thing. The pipeline stages you see in Admin Settings (New Lead, No Answer, Contacted, etc.) are the same stages that should appear in the opportunity detail dropdown.

**Root cause**: Some opportunities have `stage_name = NULL` even though they have a `pipeline_stage_id` set. Specifically:
- 3 opportunities have NULL stage_name across the database
- The opportunity you're viewing (`Mario Medina`) has `stage_name: NULL` and `pipeline_stage_id: 'local_stage_0'`
- When `stage_name` is NULL, the stage badge doesn't render at all, so there's nothing to click

The pipeline stages data IS loading correctly from the `pipeline_stages` table (confirmed via network requests -- all 10 stages return successfully). The issue is purely that the **opportunity record itself** has no `stage_name` stored.

## Plan

### 1. Backfill NULL stage_name opportunities
Write a migration to update opportunities that have `pipeline_stage_id` matching legacy `local_stage_X` format, mapping them to the correct stage name based on position. Also handle opportunities with UUID-based `pipeline_stage_id` by looking up the `pipeline_stages` table.

### 2. Always show stage badge (even when NULL)
Update `OpportunityDetailSheet.tsx` line ~3401 so the stage section always renders, showing "No stage" when `stage_name` is NULL, and still allowing the user to click to set a stage.

### Technical Details

**Migration SQL:**
```sql
-- Backfill from pipeline_stages table (UUID-based stage IDs)
UPDATE opportunities o
SET stage_name = ps.name
FROM pipeline_stages ps
WHERE o.stage_name IS NULL
  AND o.pipeline_stage_id = ps.id::text;

-- Backfill legacy local_stage_X IDs using position
UPDATE opportunities o
SET stage_name = ps.name
FROM pipeline_stages ps
WHERE o.stage_name IS NULL
  AND o.pipeline_stage_id LIKE 'local_stage_%'
  AND ps.company_id = o.company_id
  AND ps.position = CAST(REPLACE(o.pipeline_stage_id, 'local_stage_', '') AS int);
```

**UI fix in OpportunityDetailSheet.tsx (~line 3401):**
Remove the conditional that hides the stage button when `stage_name` is null. Always show a clickable stage element so users can assign a stage.

