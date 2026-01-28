

# Plan: Test PDF Field Overlay with Real Estimate Data

## Summary
Add a quick "Test Overlay" button in the Compliance Template admin that generates a filled PDF using a real estimate and opens it in a viewer for immediate visual verification.

## Problem Identified
1. **Edge Function Bug**: The `generate-compliance-documents` function uses inner joins (`!estimates_contact_uuid_fkey`) which fail when `contact_uuid` is null, returning "Estimate not found"
2. **No Quick Test UI**: There's no way to trigger generation and view the result without going through the full proposal workflow

## Implementation Steps

### Step 1: Fix Edge Function Query (Critical Bug Fix)

**File**: `supabase/functions/generate-compliance-documents/index.ts`

Change the estimate query from inner join to left join to handle null FKs:

```text
Before (lines 128-145):
.select(`
  *,
  contacts:contact_uuid!estimates_contact_uuid_fkey (...)
  opportunities:opportunity_uuid!estimates_opportunity_uuid_fkey (...)
`)

After:
.select(`
  *,
  contacts:contact_uuid (...)
  opportunities:opportunity_uuid (...)
`)
```

By removing the `!fk_name` hint, Supabase uses a left join which allows null FKs.

---

### Step 2: Add "Test Overlay" Button to ComplianceTemplatesManager

**File**: `src/components/admin/ComplianceTemplatesManager.tsx`

Add functionality to:
1. Show a "Test" button (beaker icon) next to each template
2. When clicked, open a dialog to select an estimate from a dropdown
3. Call the `generate-compliance-documents` edge function
4. Open the generated PDF in `PdfViewerDialog`

```text
New UI Flow:
Template Row -> [Test Icon] -> Select Estimate Dialog -> Generate -> View PDF
```

---

### Step 3: Create Test Dialog Component

Add inline or separate component that:
- Fetches recent estimates for the company
- Shows dropdown to pick one
- Has "Generate & Preview" button
- Shows loading state during generation
- Opens PDF viewer with result

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-compliance-documents/index.ts` | Fix FK join syntax (line ~130) |
| `src/components/admin/ComplianceTemplatesManager.tsx` | Add Test button + dialog + PDF viewer integration |

### Data Required for Test
Using an estimate with populated data:
- ID: `d2b327a7-43b8-4839-ac51-25e0d3070832`
- Customer: "Mariana Winer"
- Address: "5239 Haskell St, La Canada Flintridge, CA 91011"
- Phone: "+15626734465"

### Test Flow
1. Click Test (beaker icon) on "Contract" template
2. Select "Mariana Winer" estimate from dropdown
3. Click "Generate & Preview"
4. Edge function generates PDF with:
   - `customer_name` = "Mariana Winer"
   - `project_address` = "5239 Haskell St..."
   - `customer_phone` = "+15626734465"
5. PDF viewer opens showing the filled document

---

## Expected Outcome
After implementation, you can:
1. Go to Admin Settings > Compliance Templates
2. Click the Test button on your "Contract" template
3. Pick an estimate from the dropdown
4. Immediately see the generated PDF with your field overlays filled in

