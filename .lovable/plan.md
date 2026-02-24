

## Remove Fallback Chain & Match on Local ID in SalesRepDetailSheet

### Problem
The `SalesRepDetailSheet` uses a hybrid attribution fallback chain (opportunity → contact → appointment) to attribute opportunities to reps. This causes opportunities with no direct `assigned_to` to appear under a rep, but when clicked through to the detail page, they show "Unassigned." Additionally, the component currently receives and matches on a GHL user ID rather than the local salesperson UUID.

### What Changes

**File: `src/components/dashboard/SalesRepDetailSheet.tsx`**

1. **Rename prop** `repGhlId` → `repId` to reflect it's no longer GHL-specific. Update the interface and destructuring.

2. **Delete the fallback chain** (~lines 153-184): Remove `contactAssignmentMap`, `appointmentAssignmentMap`, and `getEffectiveAssignment` entirely.

3. **Simplify `repOpportunities` filter** (~line 187-191): Direct match only:
   ```typescript
   const repOpportunities = useMemo(() => {
     return opportunities.filter(o => 
       o.assigned_to === repId && isInDateRange(o.ghl_date_added)
     );
   }, [opportunities, repId, dateRange]);
   ```

4. **Update `repContacts` and `repAppointments`** (~lines 194-199): Replace `repGhlId` with `repId`.

**File: `src/components/dashboard/SalesRepLeaderboard.tsx`**

5. **Pass the correct ID**: The `SalesRepPerformance` object already carries `userGhlId` from the hook. The leaderboard currently maps display name → GHL ID. Since `opportunity.assigned_to` in the DB contains a mix of UUIDs and GHL IDs, we need to pass `userGhlId` as-is for now (the leaderboard hook already resolves this from the appointment's `assigned_user_id`). Rename the prop from `repGhlId` to `repId` in the call site:
   ```tsx
   <SalesRepDetailSheet
     repName={selectedRep?.name || ''}
     repId={selectedRep?.ghlId || null}  // renamed prop
     ...
   />
   ```

### Technical Notes
- The `opportunity.assigned_to` field in the database currently stores a mix of local UUIDs and legacy GHL IDs. This change ensures only directly-assigned opportunities appear, regardless of ID format.
- The broader migration of the leaderboard hook (`useGHLContacts.ts`) to also drop fallback attribution is a separate, larger change that affects dashboard-wide metrics. This plan scopes the fix to the detail sheet only.
- No database changes needed.

