

## P&L Report Restructuring

### New P&L Layout

The Profit & Loss statement will be restructured to follow this exact flow:

```text
+-------------------------------------------+--------+
| Revenues (Contracts Invoiced)              | $X     |
|   Bills Paid                               | ($X)   |
|   Bills Outstanding                        | ($X)   |
| Cost of Sales Total                        | ($X)   | <- bold subtotal
| Gross Income                               | $X     | <- bold
|   Commissions [Estimated badge if needed]  | ($X)   |
| Gross Income After Commission              | $X     | <- bold
|   Lead Cost Income                         | $X     |
| Net Income                                 | $X     | <- grand total
+-------------------------------------------+--------+
```

### Key Changes from Current

1. **Revenues** label changes to "Revenues (Contracts Invoiced)"
2. **Cost of Sales** section replaces "Cost of Goods Sold" -- broken into "Bills Paid" and "Bills Outstanding" sub-lines with a "Cost of Sales Total" subtotal
3. **Gross Income** = Revenues - Cost of Sales Total (renamed from "Gross Profit")
4. **Commissions** moves up -- deducted right after Gross Income (with "Estimated" badge if project not completed)
5. **Gross Income After Commission** = Gross Income - Commissions (new subtotal line)
6. **Lead Cost** is shown as a positive addition (income), not a deduction
7. **Net Income** = Gross Income After Commission + Lead Cost (final grand total)

### Commission Formula Fix

The commission calculation changes from:
- Current: `totalRevenue * commissionSplitPct%` (incorrect)
- New: `(totalRevenue - totalCOGS) * commissionSplitPct%` (commission on Gross Income)

Or if the intent is commission on profit after leads too, clarify -- but based on the layout requested (commission comes before lead costs), it will be calculated on Gross Income.

### Technical Details

**File:** `src/components/production/FinanceSection.tsx`

**Calculations (lines ~6518-6522):**
```typescript
const billsOutstanding = totalCOGS - totalBillsPaid;
const grossIncome = totalRevenue - totalCOGS;
const commission = grossIncome * (commissionSplitPct / 100);
const grossIncomeAfterCommission = grossIncome - commission;
const leadCost = totalRevenue * (leadCostPercent / 100);
const netIncome = grossIncomeAfterCommission + leadCost;
```

**Table rows (lines ~6558-6576):** Replace all P&L rows with the new structure using the existing `lineRow` helper -- 8 rows total with proper indentation, bold subtotals, and the "Estimated" badge on commissions when `!isCompleted`.

No changes needed to the Balance Sheet card or the PDF export (it renders the same `printRef` content).

