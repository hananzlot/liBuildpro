

## Finding

When a credit offset is applied via the bill edit form:
1. The **offset bill** (Vera Builder $8,320) is saved and synced to QB (lines 1510-1522)
2. The **target bill** (Urban $220K) has its `bill_amount` and `balance` reduced locally (lines 1468-1506) but **no QB sync is triggered** for it

## Plan

**File: `src/components/production/FinanceSection.tsx`**

After the target bill is updated with the reduced amount (around line 1506), add a second `checkQbDuplicatesAndSync` call for the target bill to push the updated amount to QuickBooks:

1. After the offset is applied to the target bill (line 1506), invoke QB sync for the target bill using its ID and updated amount
2. Use the existing `checkQbDuplicatesAndSync("bill", bill.offset_bill_id, {...})` pattern, passing the target bill's updated data (new amount, date, reference, vendor)
3. Log a toast if the target bill syncs successfully

This ensures both the credit bill and the modified target bill are reflected in QuickBooks.

