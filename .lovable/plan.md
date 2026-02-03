

# Bill Payment QuickBooks Sync - Select QB Bill for Payment

## Overview
When a user clicks "sync to QuickBooks" for a bill payment, instead of automatically creating a new bill in QB (or failing if the bill doesn't exist), the system will show a dialog listing all **unpaid bills from QuickBooks** for that vendor. The user can then select which QB bill this local payment should be applied against.

## Current Problem
1. When marking a bill as paid, the current flow first tries to sync the local bill to QuickBooks
2. If the local bill has a placeholder ID (`backfill-*`) or doesn't exist in QB, it creates a new bill
3. This results in duplicate bills in QuickBooks or mismatched records
4. Users cannot control which existing QB bill their payment applies to

## Solution
Replace the automatic bill creation with a user-driven selection workflow:

1. **When user clicks "Sync to QuickBooks"** after recording payment details:
   - Fetch all unpaid bills from QuickBooks for the matching vendor
   - Display a selection dialog showing these QB bills
   - Allow user to pick which QB bill this payment applies to
   - Link the local bill to the selected QB bill via `quickbooks_sync_log`
   - Then sync the bill payment against that linked QB bill

2. **Match by Reference Number**: 
   - Pre-select the QB bill that has a matching `DocNumber` (bill_ref) if one exists
   - This allows for automatic matching when reference numbers are consistent

---

## Technical Implementation

### 1. New Edge Function: `quickbooks-list-vendor-bills`
Create a new edge function to fetch unpaid bills for a specific vendor from QuickBooks.

**Request Body:**
```typescript
{
  companyId: string;
  vendorName: string;  // Used to find the vendor ID in QB
}
```

**Response:**
```typescript
{
  success: boolean;
  vendorId: string | null;
  vendorFound: boolean;
  bills: Array<{
    qbBillId: string;      // QuickBooks Bill ID
    docNumber: string;      // Reference number in QB
    txnDate: string;        // Bill date
    dueDate: string | null;
    totalAmt: number;       // Original bill amount
    balance: number;        // Remaining unpaid amount
    memo: string | null;
  }>;
}
```

**Logic:**
1. Get QB tokens for the company
2. Query QB for the vendor by name: `SELECT * FROM Vendor WHERE DisplayName = '{vendorName}'`
3. If vendor found, query for unpaid bills: `SELECT * FROM Bill WHERE VendorRef = '{vendorId}' AND Balance > 0`
4. Return the list of unpaid bills

**File:** `supabase/functions/quickbooks-list-vendor-bills/index.ts`

---

### 2. New Component: `QBBillSelectionDialog`
A dialog that displays when the user chooses to sync a payment to QuickBooks.

**Location:** `src/components/production/analytics/QBBillSelectionDialog.tsx`

**Props:**
```typescript
interface QBBillSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  localBillRef: string | null;
  localBillAmount: number;
  onSelect: (qbBillId: string, qbDocNumber: string) => void;
  onCancel: () => void;
}
```

**Features:**
- Fetches unpaid QB bills for the vendor when opened
- Displays a list with: Doc Number, Date, Amount, Balance
- Pre-selects the bill with matching `docNumber` = local `bill_ref` if found
- Shows loading state while fetching
- Shows "No unpaid bills found" message if none exist
- "Select" button confirms choice
- "Cancel" button aborts the sync

**UI Layout:**
```
┌─────────────────────────────────────────────┐
│ Select QuickBooks Bill                       │
│─────────────────────────────────────────────│
│ Select which QuickBooks bill this payment    │
│ should be applied against.                   │
│                                              │
│ Vendor: [Vendor Name]                        │
│ Local Bill Ref: [REF-123]                    │
│                                              │
│ ┌─────────────────────────────────────────┐ │
│ │ ○ Bill #1001 - Jan 15, 2026             │ │
│ │   Amount: $5,000  Balance: $5,000       │ │
│ │   (Matches local ref)                   │ │
│ ├─────────────────────────────────────────┤ │
│ │ ○ Bill #1002 - Jan 20, 2026             │ │
│ │   Amount: $9,500  Balance: $9,500       │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│              [Cancel]  [Select Bill]         │
└─────────────────────────────────────────────┘
```

---

### 3. Update `OutstandingAP.tsx` Payment Flow

**Current Flow:**
1. User clicks "Mark as Paid"
2. MarkAsPaidDialog opens → user enters payment details
3. On save, if QB connected → confirmation dialog appears
4. On confirm → `markAsPaidMutation` runs which:
   - Inserts bill payment
   - Syncs bill to QB (creates if needed) ← **Problem**
   - Syncs bill payment to QB

**New Flow:**
1. User clicks "Mark as Paid"
2. MarkAsPaidDialog opens → user enters payment details
3. On save, if QB connected → **QB Bill Selection Dialog** opens
4. Dialog fetches unpaid QB bills for the vendor
5. User selects which QB bill to apply payment against
6. On confirm → `markAsPaidMutation` runs which:
   - Inserts bill payment
   - **Creates/updates sync log** to link local bill → selected QB bill
   - Syncs bill payment to QB (using the selected QB bill ID)

**Changes to `OutstandingAP.tsx`:**
- Add new state for `qbBillSelectionDialogOpen` and `selectedQbBill`
- Import and render `QBBillSelectionDialog`
- Modify `handleMarkAsPaidSave` to open selection dialog instead of confirmation
- Update `markAsPaidMutation` to:
  - Accept `qbBillId` parameter
  - Upsert sync log entry linking local bill to selected QB bill
  - Skip automatic bill sync (bill already exists in QB)
  - Sync only the bill payment

---

### 4. Update `sync-to-quickbooks` Edge Function

Add a new mode to link a local bill to an existing QB bill without re-syncing:

**New Request Option:**
```typescript
{
  companyId: string;
  syncType: "link_bill";  // New type
  recordId: string;       // Local bill ID
  qbBillId: string;       // QB Bill ID to link to
}
```

**Logic:**
1. Verify the QB bill exists (fetch it)
2. Upsert `quickbooks_sync_log` entry:
   - `record_type: "bill"`
   - `record_id: {localBillId}`
   - `quickbooks_id: {qbBillId}`
   - `sync_status: "synced"`
3. Return success

---

### 5. Database Matching by Reference Number

The `bill_ref` in the local database should ideally match the `DocNumber` in QuickBooks. The selection dialog will:

1. Pre-select any QB bill where `DocNumber` matches the local `bill_ref`
2. Show a "(Matches local ref)" indicator for visual confirmation
3. This enables quasi-automatic matching when users maintain consistent reference numbers

---

## Files to Create/Modify

### New Files:
1. `supabase/functions/quickbooks-list-vendor-bills/index.ts` - Edge function to list vendor's unpaid QB bills
2. `src/components/production/analytics/QBBillSelectionDialog.tsx` - Selection dialog component

### Modified Files:
1. `src/pages/OutstandingAP.tsx` - Update payment flow to use new selection dialog
2. `supabase/functions/sync-to-quickbooks/index.ts` - Add "link_bill" sync type
3. `supabase/config.toml` - Register new edge function

---

## Edge Cases Handled

1. **No unpaid QB bills for vendor**: Show message, allow user to cancel
2. **Vendor not found in QB**: Show error, suggest checking vendor name/mapping
3. **Multiple bills with same reference**: User manually selects the correct one
4. **Bill already partially paid in QB**: Show current balance, user can verify amount matches
5. **Local payment amount > QB bill balance**: Warning shown, but allow (partial payments possible)

