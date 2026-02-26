

## Plan: Replace Invoice Dialog with Confirmation Prompt + Deferred Save

### Current Flow
1. User clicks the invoice badge (FileText icon) on a progress payment
2. A full invoice form dialog opens (agreement, phase, amount pre-filled but editable)
3. User clicks "Save" → invoice is saved to DB immediately → PDF preview opens

### New Flow
1. User clicks the invoice badge → an **AlertDialog confirmation prompt** appears:
   - "Do you want to invoice the customer the full progress payment amount of **$XX,XXX**?"
   - Three options: **Yes, full amount** | **Enter different amount** | **Cancel**
2. If "Enter different amount" → show an inline input field with validation (max = uninvoiced balance for that phase)
3. On confirm → show the **InvoicePdfDialog preview** with the invoice data but **do NOT save yet**
4. The PDF preview buttons change behavior:
   - **Save & Close** → save to DB, close dialog
   - **Print & Save** → save to DB, print, close
   - **Download & Save** → save to DB, trigger download, close
   - **Email & Save** → save to DB, open mailto, close
   - **Cancel** → discard, close dialog (no save)
5. Amount validation: the entered amount cannot exceed `(phase.amount - totalAlreadyInvoiced)` for that phase

### Implementation Steps

1. **Create an `InvoiceConfirmDialog` component** — a new AlertDialog-based component that:
   - Receives phase name, full amount (uninvoiced balance), and callbacks
   - Shows the confirmation question with the amount
   - Has a "different amount" mode with an input field + validation
   - Returns the confirmed amount to the parent

2. **Update `InvoicePdfDialog` to accept an `onSave` callback** — instead of just being a read-only preview:
   - Add an `onSave` prop (optional, for deferred-save mode)
   - When `onSave` is provided, the toolbar buttons trigger save before their action
   - Add a "Cancel" button that closes without saving
   - Rename buttons to include "& Save" suffix

3. **Update `FinanceSection.tsx` invoice badge click handler** — replace the current flow:
   - Instead of opening `InvoiceDialog`, open the new `InvoiceConfirmDialog`
   - On confirm, compute invoice data (invoice number, date, amount, phase, agreement)
   - Open `InvoicePdfDialog` in deferred-save mode (passing `onSave` that calls `saveInvoiceMutation`)
   - Keep the existing `InvoiceDialog` for the "Add Invoice" button in the Invoices tab and for editing

4. **Wire up the save mutation** — the `onSave` in InvoicePdfDialog triggers `saveInvoiceMutation.mutate(data)` with the prepared invoice data

### Files to Create/Edit
- **New**: `src/components/production/InvoiceConfirmDialog.tsx`
- **Edit**: `src/components/production/InvoicePdfDialog.tsx` — add `onSave` prop, cancel button, conditional save logic
- **Edit**: `src/components/production/FinanceSection.tsx` — new state for confirm dialog, rewire badge click handler

