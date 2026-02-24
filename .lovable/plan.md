

## Simplify Header to Show Unique Opportunity Count

**What**: Replace the confusing "34 contacts (52 directly assigned)" text in the `SalesRepDetailSheet` header with just the count of unique opportunities assigned to the rep within the date range.

**Where**: `src/components/dashboard/SalesRepDetailSheet.tsx`, line ~243

**Change**:

Replace:
```tsx
<p className="text-sm text-muted-foreground">
  {uniqueContactsCount} contacts ({repContacts.length} directly assigned)
</p>
```

With:
```tsx
<p className="text-sm text-muted-foreground">
  {repOpportunities.length} opportunities
</p>
```

This uses the already-computed `repOpportunities` array which is filtered by the rep's hybrid attribution and the active date range. No other changes needed.

