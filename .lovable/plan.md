

## Plan

### 1. Add tooltip to the Profit column header
In `src/pages/Production.tsx` (lines 2055-2058), wrap the "Profit" header text with a `Tooltip` showing the formula: **Revenue − COGS − Commission + Lead Fee**.

### 2. Add "est" badge next to profit for non-completed projects
In `src/pages/Production.tsx` (lines 2268-2271), when `financials?.isCompleted` is false and profit is displayed, append a small "est" badge (using a `<span>` with muted styling) next to the profit value to indicate the figure is an estimate.

### Files modified
- `src/pages/Production.tsx` — add Tooltip import (if not already present), wrap Profit header, add "est" indicator in profit cell.

