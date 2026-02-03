

## Summary

Add a new "Notes to Customer" field that appears on all proposal views, previews, and signed contracts, while renaming the existing "Notes" field to "Internal Notes" and hiding it from customer-facing views.

---

## Database Changes

### Add New Column to `estimates` Table

A migration will add a new `notes_to_customer` column:

```sql
ALTER TABLE estimates ADD COLUMN notes_to_customer TEXT;
```

---

## Frontend Changes

### 1. Update `EstimateBuilderDialog.tsx`

**Interface Change:**
Add `notes_to_customer` to the `EstimateFormData` interface:

```typescript
interface EstimateFormData {
  // ... existing fields
  notes: string;  // Keep as is - now "Internal Notes"
  notes_to_customer: string;  // NEW - visible to customers
  // ...
}
```

**Default State:**
Add default empty string for `notes_to_customer` in initial state.

**UI Change (Terms Tab):**
Rename the existing "Notes" card to "Internal Notes" and add a new "Notes to Customer" card:

| Current | Updated |
|---------|---------|
| Notes | Internal Notes |
| (none) | Notes to Customer (NEW) |

The section will have:
- **Internal Notes** - with placeholder: "Add internal notes (not visible to customer)..."
- **Notes to Customer** - with placeholder: "Add notes that will be shown to the customer on proposals and contracts..."

**Save Logic:**
Update all save mutation payloads to include `notes_to_customer`:

```typescript
notes_to_customer: formData.notes_to_customer || null,
```

**Draft Persistence:**
Include `notes_to_customer` in the draft data for sessionStorage and database backup.

---

### 2. Update `ProposalContent.tsx`

**Interface Change:**
Add `notes_to_customer` to the `ProposalEstimate` interface:

```typescript
export interface ProposalEstimate {
  // ... existing fields
  notes?: string | null;  // Internal notes
  notes_to_customer?: string | null;  // NEW - customer-visible
  // ...
}
```

**Rename Existing Notes Section:**
Change the internal notes section title from "Additional Notes" to "Internal Notes" (this section is already hidden from customers via the `showNotes` prop).

**Add Customer Notes Section:**
Add a new section that always displays when `notes_to_customer` has content:

```tsx
{/* Notes to Customer - Always visible when content exists */}
{estimate.notes_to_customer && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        Notes
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground whitespace-pre-wrap">
        {estimate.notes_to_customer}
      </p>
    </CardContent>
  </Card>
)}
```

This will appear:
- After Terms & Conditions
- Before Signatures section

---

### 3. Update `EstimatePreviewDialog.tsx`

No changes needed - it uses `ProposalContent` which will automatically display the new customer notes.

---

### 4. Update `PortalEstimateView.tsx`

No changes needed - it also uses `ProposalContent` which will automatically display the new customer notes when present.

---

## Backend Changes

### Update `generate-contract-pdf/index.ts`

Add a new "NOTES" section to the PDF generation that renders before Terms & Conditions (or another logical position):

```typescript
// NOTES TO CUSTOMER
if (estimate.notes_to_customer) {
  checkNewPage(60);
  
  page.drawText('NOTES', { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
  yPos -= 5;
  page.drawLine({
    start: { x: margin, y: yPos },
    end: { x: width - margin, y: yPos },
    thickness: 1,
    color: lightGray,
  });
  yPos -= 15;

  drawWrappedText(estimate.notes_to_customer, margin + 5, contentWidth - 10, 10, helvetica, gray);
  yPos -= 20;
}
```

---

## Visual Summary

### Admin View (Estimate Builder - Terms Tab)

```
+---------------------------+
| Internal Notes            |
| [Text area for internal   |
|  notes - not shown to     |
|  customers]               |
+---------------------------+

+---------------------------+
| Notes to Customer         |
| [Text area for notes      |
|  visible on proposals     |
|  and contracts]           |
+---------------------------+

+---------------------------+
| Terms & Conditions        |
| [Text area]               |
+---------------------------+
```

### Customer View (Portal / Preview / Contract PDF)

```
Terms & Conditions
...content...

Notes                     <-- NEW (only if has content)
...customer-facing notes...

Digital Signatures
...
```

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/xxx.sql` | Add `notes_to_customer` column |
| `src/components/estimates/EstimateBuilderDialog.tsx` | Add field to interface, state, UI, save logic |
| `src/components/proposals/ProposalContent.tsx` | Add interface field, rename internal notes title, add customer notes section |
| `supabase/functions/generate-contract-pdf/index.ts` | Add NOTES section to PDF |

### No Changes Needed

- `EstimatePreviewDialog.tsx` - Uses ProposalContent
- `PortalEstimateView.tsx` - Uses ProposalContent
- `generate-compliance-documents` - Already accesses notes for placeholders

---

## Data Flow

1. Admin enters "Internal Notes" (stored as `notes`) and "Notes to Customer" (stored as `notes_to_customer`)
2. When previewing or viewing in portal, `ProposalContent` displays:
   - "Notes" section with `notes_to_customer` content (customer-visible)
   - "Internal Notes" section with `notes` content (admin-only, controlled by `showNotes` prop)
3. When PDF is generated, `notes_to_customer` is rendered in the "NOTES" section
4. Internal notes remain hidden from all customer-facing views

