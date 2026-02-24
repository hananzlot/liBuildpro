

## Why the $5K Record Disappeared

The 5th record ($5K, "David F") was assigned via UUID `652d0c5d-71a8-4e33-ae99-e2dcdd1c516b`, which is a salesperson belonging to **CA Pro Builders** (a different company). With strict company isolation restored, Demo Co.'s salesperson lookup can't resolve that UUID to a name, so it stays as a raw UUID. The `isUnresolvedId` filter we just added then removes it entirely - hiding $5K in revenue.

## Plan

**Replace the "filter out" logic with a "rename to Unknown Rep" approach** in `src/hooks/useGHLContacts.ts`:

1. **Remove the `isUnresolvedId` filter** (line 852) that drops records from the array.
2. **Add a rename step** before sorting: iterate through the merged performance map and replace any unresolved UUID/ID names with `"Unknown Rep"`. If "Unknown Rep" already exists, merge the values together.
3. This ensures no revenue is silently hidden - all won opportunities will appear, attributed to either a resolved name or "Unknown Rep".

### Technical Detail

```
// Before sorting, consolidate unresolved IDs into "Unknown Rep"
mergedPerformanceMap.forEach((rep, key) => {
  if (isUnresolvedId(rep.assignedTo)) {
    const unknownKey = "Unknown Rep";
    const existing = mergedPerformanceMap.get(unknownKey);
    if (existing) {
      // Merge values into existing Unknown Rep entry
      existing.wonValue += rep.wonValue;
      existing.wonValueFromWonAt += rep.wonValueFromWonAt;
      // ... merge other fields
    } else {
      mergedPerformanceMap.set(unknownKey, { ...rep, assignedTo: unknownKey });
    }
    mergedPerformanceMap.delete(key);
  }
});
```

**File to edit**: `src/hooks/useGHLContacts.ts` (lines 845-853)

