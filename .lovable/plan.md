
## Fix Pipeline Source Priority: Admin Config Always Wins Over GHL

### Problem

Two components currently resolve pipeline stages in different ways:

| Component | Current Behavior | Desired Behavior |
|---|---|---|
| `OpportunityDetailSheet.tsx` | Correctly skips GHL when admin config exists (line 575) | Already correct |
| `NewEntryDialog.tsx` | Checks `ghl_pipelines` FIRST, falls back to `company_settings` | Must be reversed |

The `NewEntryDialog.tsx` pipeline resolution order is inverted. It currently tries GHL first, then admin settings. The user wants: **if admin pipeline stages are configured (either in `pipeline_stages` table OR `company_settings`), skip GHL entirely.**

### Root Cause

In `src/components/dashboard/NewEntryDialog.tsx`, lines 119–230, the fetch order is:
1. `ghl_pipelines` table → if found, use and return early
2. `company_settings` pipeline_stages → fallback
3. Derived from `opportunities` → last fallback

This must be reversed so admin config is always checked first.

### Fix

**`src/components/dashboard/NewEntryDialog.tsx`** — Rewrite `fetchPipelineStages` function to use the correct priority:

```text
Priority 1 (highest): pipeline_stages table (UUID-based, new system)
Priority 2: company_settings "pipeline_stages" key (legacy admin config)
Priority 3: ghl_pipelines table (GHL data, only if NO admin config)
Priority 4: derive from opportunities records (last resort)
```

The key rule: **if Priority 1 or Priority 2 yields any stages, stop immediately and never touch GHL data.**

### Technical Details

**File to change:** `src/components/dashboard/NewEntryDialog.tsx`

The `fetchPipelineStages` async function (inside `useEffect`) will be restructured:

1. **Step 1** — Query `pipeline_stages` table for this `companyId`, ordered by `position`.
   - If rows exist → build stage list from them, set state, return early (do not check GHL).

2. **Step 2** — Query `company_settings` for `pipeline_stages` and `default_pipeline_name` keys.
   - If `pipeline_stages` setting has a value → parse it, build stage list, return early (do not check GHL).

3. **Step 3** — Only if both steps above returned nothing → query `ghl_pipelines` table.
   - Build stages from GHL data as before.

4. **Step 4** — Final fallback → derive stages from existing `opportunities` records (unchanged).

This exactly mirrors the logic already in `useCompanyPipelineSettings` hook and in `OpportunityDetailSheet.tsx`, making behavior consistent across both entry points.

### No Database Changes

No migrations needed. This is purely a frontend logic reorder within one component.

### Files to Edit

- `src/components/dashboard/NewEntryDialog.tsx` — Restructure `fetchPipelineStages` function priority order
