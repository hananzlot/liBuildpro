
## Add Average Commission % and Lead Cost % to P&L Labels

### What Changes
In the P&L Statement, the "Commissions" and "Lead Cost Income" line items will display the average percentage used next to their label -- e.g., **"Commissions (avg 48.5%)"** and **"Lead Cost Income (avg 17.2%)"**.

### How It Works

**Aggregate view:** Compute a revenue-weighted average of each project's `commission_split_pct` and `lead_cost_percent` across all included projects. This gives a meaningful average that reflects how much each project contributes to the total.

**Per-project view:** Show the exact percentage used for that specific project (e.g., "Commissions (50%)" and "Lead Cost Income (18%)").

### Technical Details

**File:** `src/components/production/analytics/PnLStatement.tsx`

1. **Extend `buildPnLLines` parameters** to accept two new optional fields: `avgCommissionPct` and `avgLeadCostPct`.

2. **Update label rendering** for the Commissions and Lead Cost Income rows to include the percentage in a muted style:
   - `Commissions (avg 48.5%)` for aggregate
   - `Commissions (50%)` for per-project

3. **Compute weighted averages in `computeAggregate`:**
   - Weighted avg commission = sum(project.contractsTotal * project.commission_split_pct) / sum(project.contractsTotal) for projects with revenue > 0
   - Same approach for lead cost percent
   - Uses each project's `commission_split_pct` (default 50) and `lead_cost_percent` (default 18)

4. **Per-project data** will pass each project's individual `commission_split_pct` and `lead_cost_percent` directly.

5. The percentage will be rendered as a `<span>` with `text-muted-foreground text-xs` styling so it's visible but doesn't dominate the label.
