
# Fix Bill Payment QuickBooks Sync in Outstanding AP

## Problem
When you mark a bill as paid from the "Paid" tab in Outstanding AP, the payment is only saved to the local database. It does not sync to QuickBooks because the code is missing the integration call.

## Root Cause
The `markAsPaidMutation` in `OutstandingAP.tsx` performs a simple database insert but skips the QuickBooks synchronization steps that exist in the project-level Finance section.

## Solution
Update `OutstandingAP.tsx` to include QuickBooks sync logic after creating a payment, following the same pattern used in `FinanceSection.tsx`.

---

## Technical Details

### Changes to `src/pages/OutstandingAP.tsx`

1. **Check QuickBooks connection status**: Fetch whether the company has an active QuickBooks connection.

2. **Update the `markAsPaidMutation`** to:
   - Insert the payment (already done)
   - Calculate total payments and update the bill's `amount_paid` / `balance` fields
   - If QuickBooks is connected:
     - Sync the **bill** first (ensures it exists in QB)
     - Then sync the **bill_payment** to QuickBooks
   - Return sync status for appropriate toast messaging

3. **Update success handler** to show:
   - "Payment recorded and synced to QuickBooks" if sync succeeded
   - "Payment recorded" if no QB connection or sync not enabled

### Code Changes Summary

```
markAsPaidMutation
├── Insert bill_payment record
├── Fetch all payments for the bill
├── Calculate new amount_paid and balance
├── Update project_bills with new totals
├── If QB connected:
│   ├── Sync bill to QuickBooks
│   └── Sync bill_payment to QuickBooks
├── Clear scheduled payment fields
└── Return { qbSynced: boolean }
```

### Files Modified
- `src/pages/OutstandingAP.tsx` - Add QB sync logic to `markAsPaidMutation`
