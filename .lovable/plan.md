

## Investigation Results

### Why "929 contacts (1294 directly assigned)" is wrong

The `SalesRepDetailSheet` receives **ALL** contacts, opportunities, and appointments from the entire database — not filtered by the dashboard's date range. When it calculates:

- **"1294 directly assigned"**: It counts every contact in the DB where `assigned_to === repGhlId` (line 180) — this is ALL-TIME, not date-filtered
- **"929 contacts"**: It counts unique contact IDs across ALL opportunities + ALL appointments for that rep (line 189-200) — again ALL-TIME

The leaderboard card on the dashboard correctly uses date-filtered data for its summary numbers, but when you click into the detail sheet, it gets the unfiltered `allOpportunities` and `allContacts` arrays (see Index.tsx lines 447-449).

### What "Leads by Source" shows

The "Leads by Source" section (line 252-261) groups the **directly assigned contacts** (all 1294) by their `source` field. It shows how many contacts came from each lead source (Facebook, Yakir, Miami, etc.). The counts are inflated because they're not date-filtered — they represent the rep's entire historical contact base.

### Fix Plan

**Pass the date range into the detail sheet** and filter all data accordingly:

1. **`SalesRepLeaderboard.tsx`** — Accept and forward `dateRange` prop to `SalesRepDetailSheet`
2. **`SalesRepDetailSheet.tsx`** — Accept `dateRange` prop and filter:
   - `repContacts` → filter by `date_added` within range
   - `repAppointments` → filter by `start_time` within range  
   - `repOpportunities` → filter by `ghl_date_added` within range
   - `uniqueContactsCount` → recalculates from filtered data
   - `leadsBySource` → recalculates from filtered contacts
3. **`Index.tsx`** — Pass `dateRange` to `SalesRepLeaderboard`

This ensures the detail sheet matches what the leaderboard card shows for the selected date range.

### Technical Details

- The `dateRange` object is already available in `Index.tsx` (used for `RecentWonDeals`)
- Props chain: `Index.tsx → SalesRepLeaderboard → SalesRepDetailSheet`
- Date filtering logic: compare record dates against `dateRange.from` and `dateRange.to` using simple Date comparisons
- The "Leads by Source" section will then show only contacts added within the date range, making it useful for understanding which sources are driving leads in the selected period

