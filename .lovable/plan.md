

# Compact Professional Layout for Estimates Page

## Problem
The Estimates page wastes significant vertical space with three layers of redundant information stacked before the actual table data:
1. **Page header** with title + subtitle that changes per tab
2. **4 KPI summary cards** (each ~100px tall) showing count + total per status
3. **Tab bar** that repeats the same categories with counts
4. **Card wrapper** inside each tab with yet another title + description

The KPI cards and tabs show the same information (Estimates, Proposals, Contracts, Declined) -- the counts are duplicated in both places.

## Solution
Consolidate everything into a single compact header row, similar to how the Opportunities page works. The KPI values will be embedded directly into the tab triggers, eliminating the separate card grid entirely.

### New Layout (top to bottom):
1. **Single header row**: Title on the left, action buttons (Refresh, New Estimate) on the right
2. **Enhanced tab bar**: Each tab trigger shows the category name, count, AND dollar total inline -- replacing both the old tabs and KPI cards
3. **Table directly below**: Remove the redundant Card > CardHeader wrapper inside each TabsContent

### Visual comparison:

```text
BEFORE (~300px before data):
+------------------------------------------+
| Estimates                    [Refresh][+] |  <- header
| Create and manage estimates               |  <- subtitle
+------------------------------------------+
| [Estimates 5] [Proposals 3] [Contracts 2] |  <- KPI cards row
| [$50,000]     [$30,000]     [$20,000]     |
+------------------------------------------+
| [Estimates(5)][Proposals(3)][Contracts(2)]|  <- tabs (duplicate)
+------------------------------------------+
| All Estimates                             |  <- card header (duplicate)
| View and manage all draft estimates       |  <- card description
+------------------------------------------+
| # | Customer | Title | ...               |  <- FINALLY the data

AFTER (~80px before data):
+------------------------------------------+
| Estimates                    [Refresh][+] |  <- compact header
+------------------------------------------+
| [Estimates 5 $50K][Proposals 3 $30K][...]|  <- tabs WITH KPI data
+------------------------------------------+
| # | Customer | Title | ...               |  <- data immediately
```

## Technical Details

### File: `src/pages/Estimates.tsx`

**Changes:**
- Remove the subtitle `<p>` from the header (the tab selection makes it obvious)
- Remove the entire "Summary Cards" grid (lines 688-730)
- Update each `TabsTrigger` to show count + formatted dollar total (e.g., "Estimates (5) $50K")
- Remove `Card`, `CardHeader`, `CardTitle`, `CardDescription` wrappers inside each `TabsContent` -- render the table directly with minimal padding
- Reduce `mt-6` on `TabsContent` to `mt-2` for tighter spacing
- Reduce outer container gap from `gap-6` to `gap-3`

This is a single-file change. No new components or dependencies are needed.

