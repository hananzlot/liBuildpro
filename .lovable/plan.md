

# Project-to-Customer QuickBooks Mapping

## Problem Summary
When syncing bill payments to QuickBooks, the system can't distinguish between bills for different projects/customers from the same vendor. This happens because:

1. **Project #16** (14223 Haynes St, Margarit Minasyan) has no `contact_uuid`, so no QB customer mapping exists
2. The QB Bill Selection dialog shows ALL unpaid bills for the vendor, not filtered by project/customer
3. When syncing bills, the `CustomerRef` isn't correctly applied for job costing

## Solution Overview
Create a **project-to-customer mapping** workflow:

1. When opening the QB Bill Selection dialog, check if the project has a QB customer mapping
2. If not mapped, show a **customer selection step first** before showing bills
3. Store the project-to-customer mapping for future syncs
4. Filter bills by CustomerRef to only show relevant ones

---

## Database Changes

### Add New Mapping Type: `project_customer`
Use the existing `quickbooks_mappings` table with a new `mapping_type`:

```sql
-- Store project-to-customer mappings
-- source_value = project UUID
-- qbo_id = QuickBooks Customer ID
-- qbo_name = QB Customer display name
-- mapping_type = 'project_customer'
```

No schema change needed - the existing table structure supports this.

---

## UI/UX Flow Changes

### New Flow for Bill Payment Sync

```text
User clicks "Sync to QuickBooks"
        |
        v
+---------------------------+
| Check project QB mapping  |
+---------------------------+
        |
   Has mapping? 
        |
    No  |   Yes
        |     |
        v     v
+----------------+    +------------------+
| QB Customer    |    | QB Bill          |
| Selection      |--->| Selection        |
| Dialog         |    | Dialog           |
| (Step 1)       |    | (filtered by     |
+----------------+    | CustomerRef)     |
        |             +------------------+
        |                     |
   User selects               |
   customer                   |
        |                     |
        v                     v
+----------------+    +------------------+
| Save mapping   |    | Sync bill        |
| to DB          |--->| payment to QB    |
+----------------+    +------------------+
```

### Customer Selection Options
When no mapping exists:
1. **Select existing QB customer** - User picks from dropdown
2. **Skip QB sync** - Record payment locally only (no QB sync)
3. **Create new customer in QB** - Creates customer from project name/address

---

## Technical Implementation

### 1. New Component: `QBCustomerMappingDialog`
**File:** `src/components/production/analytics/QBCustomerMappingDialog.tsx`

A dialog that:
- Fetches all QB customers via `quickbooks-list-entities`
- Displays a searchable dropdown
- Shows project info (name, customer name, address)
- Options: Select Customer | Skip QB Sync | Cancel

### 2. Update `QBBillSelectionDialog`
**File:** `src/components/production/analytics/QBBillSelectionDialog.tsx`

Changes:
- Accept new `projectId` prop
- Pass `projectId` to the edge function for customer-filtered bill fetching
- Show customer name alongside each bill (for context)

### 3. Update `quickbooks-list-vendor-bills` Edge Function
**File:** `supabase/functions/quickbooks-list-vendor-bills/index.ts`

Changes:
- Accept optional `projectId` parameter
- Look up project-to-customer mapping first
- If mapping exists, filter QB query: `WHERE VendorRef = 'X' AND CustomerRef = 'Y'`
- Return `customerName` and `customerId` in response for display
- If no mapping, return all bills but include CustomerRef info for each

### 4. Update `OutstandingAP.tsx` Payment Flow
**File:** `src/pages/OutstandingAP.tsx`

Changes:
- Add state for `customerMappingDialogOpen`
- Include `projectId` in `pendingPaymentData`
- Before opening bill selection, check if project has QB customer mapping
- If no mapping: open Customer Mapping dialog first
- Pass mapping info through the flow

### 5. Create Project-Customer Mapping on Selection
When user selects a QB customer in the Customer Mapping dialog:
- Insert into `quickbooks_mappings`:
  - `mapping_type: 'project_customer'`
  - `source_value: {projectId}`
  - `qbo_id: {selectedQBCustomerId}`
  - `qbo_name: {selectedQBCustomerName}`
- Then proceed to bill selection

---

## Edge Cases Handled

| Case | Behavior |
|------|----------|
| Project has contact with QB mapping | Use contact mapping (existing behavior) |
| Project has direct project_customer mapping | Use project mapping |
| Project has neither mapping | Show Customer Mapping dialog |
| User clicks "Skip QB Sync" | Record payment locally, skip QB sync |
| Same vendor, different projects | Each project shows only its customer's bills |
| Customer not in QB yet | "Create new in QB" option available |

---

## Files to Create/Modify

### New Files
1. `src/components/production/analytics/QBCustomerMappingDialog.tsx`

### Modified Files
1. `src/components/production/analytics/QBBillSelectionDialog.tsx` - Add projectId, show customer info
2. `supabase/functions/quickbooks-list-vendor-bills/index.ts` - Filter by CustomerRef
3. `src/pages/OutstandingAP.tsx` - Add customer mapping check + dialog

---

## Benefits

1. **Accurate job costing** - Bills are correctly linked to projects/customers in QB
2. **Clear bill selection** - Only shows relevant bills for the specific project
3. **Persistent mapping** - Once mapped, future syncs are automatic
4. **Flexible** - Works with or without contacts, user can always override
5. **Opt-out option** - Users can record payments locally without QB sync

