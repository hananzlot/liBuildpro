
# Plan: Fix contact_uuid on Estimates + Remove Duplicate Scope of Work Section

## Summary of Changes

Three distinct changes will be made:

1. **Database trigger** on the `estimates` table to auto-populate `contact_uuid` from the linked opportunity when null.
2. **Database backfill SQL** to fix all existing estimates that have `opportunity_uuid` but null `contact_uuid`.
3. **Code fix** in `EstimateBuilderDialog.tsx` to always resolve `contact_uuid` from the opportunity before saving (even when `contact_uuid` is null on the opportunity object, fall back to fetching it from the DB via `opportunity_uuid`).
4. **Remove the standalone Scope of Work collapsible section** in `AppointmentDetailSheet.tsx` (lines ~1681–1698), since that data already appears inside the linked Opportunity section.

---

## Change 1: Database Migration — Trigger + Backfill

### Backfill SQL
Runs once to fix all existing estimates where `contact_uuid` is null but the linked opportunity has a valid `contact_uuid`:

```sql
UPDATE estimates e
SET contact_uuid = o.contact_uuid
FROM opportunities o
WHERE e.opportunity_uuid = o.id
  AND e.contact_uuid IS NULL
  AND o.contact_uuid IS NOT NULL;
```

### Database Trigger
A `BEFORE INSERT OR UPDATE` trigger on `estimates` that, when `contact_uuid` is null and `opportunity_uuid` is set, looks up the opportunity and copies over its `contact_uuid`:

```sql
CREATE OR REPLACE FUNCTION public.sync_estimate_contact_uuid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only act when contact_uuid is missing but opportunity_uuid is present
  IF NEW.contact_uuid IS NULL AND NEW.opportunity_uuid IS NOT NULL THEN
    SELECT contact_uuid
    INTO NEW.contact_uuid
    FROM public.opportunities
    WHERE id = NEW.opportunity_uuid
      AND contact_uuid IS NOT NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_estimate_contact_uuid
BEFORE INSERT OR UPDATE ON public.estimates
FOR EACH ROW
EXECUTE FUNCTION public.sync_estimate_contact_uuid();
```

---

## Change 2: Code Fix in EstimateBuilderDialog.tsx

### Problem
At line ~1074, `contact_uuid` is only copied from the `linkedOpportunity` prop if `linkedOpportunity.contact_uuid` is already non-null:

```typescript
if (linkedOpportunity.contact_uuid) {
  setLinkedContactUuid(linkedOpportunity.contact_uuid);
  setLinkedContactId(linkedOpportunity.contact_id);
}
```

If the opportunity object was fetched without `contact_uuid` being populated (race condition or missing backfill), the estimate is saved with a null `contact_uuid`.

### Fix
Inside the `saveMutation.mutationFn`, just before building `estimateData`, add a resolution step: if `linkedContactUuid` is still null but `linkedOpportunityUuid` is set, perform a quick Supabase query to fetch the opportunity's `contact_uuid` from the DB and use it:

```typescript
// Resolve contact_uuid from opportunity if still missing
let resolvedContactUuid = linkedContactUuid;
if (!resolvedContactUuid && linkedOpportunityUuid) {
  const { data: oppData } = await supabase
    .from("opportunities")
    .select("contact_uuid")
    .eq("id", linkedOpportunityUuid)
    .maybeSingle();
  if (oppData?.contact_uuid) {
    resolvedContactUuid = oppData.contact_uuid;
  }
}
```

Then use `resolvedContactUuid` in `estimateData` instead of `linkedContactUuid`.

---

## Change 3: Remove Standalone Scope of Work from AppointmentDetailSheet.tsx

### Location
Lines 1680–1698 in `src/components/dashboard/AppointmentDetailSheet.tsx`.

### What to Remove
The entire `{/* Scope of Work - Collapsible */}` block:

```tsx
{scopeOfWork && (
  <Collapsible open={openSections.scope} onOpenChange={() => toggleSection('scope')}>
    <div className="border rounded-lg overflow-hidden">
      <CollapsibleTrigger ...>
        <Briefcase ... />
        <span>Scope of Work</span>
        ...
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="text-sm whitespace-pre-wrap">{scopeOfWork}</p>
      </CollapsibleContent>
    </div>
  </Collapsible>
)}
```

### Why It's Safe
The `scopeOfWork` value (derived from `contact.custom_fields` or `attributions`) is already rendered inside the **Opportunity section** of the same sheet — specifically, `primaryOpportunity.scope_of_work` is displayed and editable in the opportunity collapsible at lines ~1456–1463. Removing this standalone card eliminates the duplication without losing any data.

The `scopeOfWork` variable and the `openSections.scope` key can be left in state (unused variables cause no runtime harm), or cleaned up too for completeness.

---

## Files Changed

| File | Type of Change |
|---|---|
| Supabase migration (new) | Backfill SQL + trigger function + trigger |
| `src/components/estimates/EstimateBuilderDialog.tsx` | Add contact_uuid resolution in saveMutation |
| `src/components/dashboard/AppointmentDetailSheet.tsx` | Remove standalone Scope of Work collapsible block |
