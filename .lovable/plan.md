

# Plan: Fix and Enhance Compliance Document Placeholder Replacement

## Summary

Your uploaded PDF template "CA Pro- Contract.pdf" is stored correctly, but the placeholder replacement system needs two fixes:
1. **Bug Fix**: The edge function fails due to an ambiguous database relationship
2. **Implementation Gap**: The edge function collects placeholder data but doesn't actually replace text in the PDF yet

## Current Status

- **Template Uploaded**: Successfully stored at `compliance-templates` bucket
- **Database Record**: Created in `compliance_document_templates` with `requires_separate_signature: true`
- **Edge Function**: Has a bug preventing execution + doesn't do actual PDF text replacement

---

## Implementation Plan

### Phase 1: Fix Edge Function Bug

**File**: `supabase/functions/generate-compliance-documents/index.ts`

**Issue**: Query uses `contacts:contact_uuid` but there are two foreign key relationships, causing:
```
Could not embed because more than one relationship was found
```

**Fix**: Specify the exact relationship:
```typescript
// Change from:
contacts:contact_uuid (...)

// To:
contacts:contact_uuid!estimates_contact_uuid_fkey (...)
```

Also fix the `opportunities` join if it has the same issue.

---

### Phase 2: Implement PDF Placeholder Replacement

**Two approaches available:**

#### Option A: PDF Form Fields (Recommended if your PDF has form fields)
If your PDF was created with fillable form fields named like `customer_name`, `estimate_total`, etc., we can use `pdf-lib` to fill them:

```typescript
import { PDFDocument } from 'https://cdn.skypack.dev/pdf-lib@1.17.1?dts';

// Load PDF
const pdfBytes = await fetch(template.template_file_url).then(r => r.arrayBuffer());
const pdfDoc = await PDFDocument.load(pdfBytes);
const form = pdfDoc.getForm();

// Fill fields
try {
  form.getTextField('customer_name')?.setText(placeholderData.customer_name);
  form.getTextField('estimate_total')?.setText(placeholderData.estimate_total);
  // ... etc
} catch (e) {
  console.log('Field not found or not a form field');
}

// Save and upload the filled PDF
const filledPdfBytes = await pdfDoc.save();
```

#### Option B: Text Replacement (If PDF has literal `{{placeholder}}` text)
This is more complex as pdf-lib cannot directly find/replace text. Would require:
1. An external PDF service (like Adobe PDF Services API, DocuSign, or similar)
2. Or converting the PDF workflow to use HTML-to-PDF generation

---

### Phase 3: Upload Generated PDF to Storage

After filling the PDF:
1. Upload the generated PDF to `compliance-templates` bucket under a subfolder like `generated/{estimateId}/`
2. Update `estimate_compliance_documents.generated_file_url` with the new URL
3. The customer portal will then show the filled document

---

### Phase 4: Add Test/Preview Feature (Optional Enhancement)

Add a "Preview Placeholders" button in the Admin Compliance Templates section that:
1. Shows what data would be merged for a sample estimate
2. Allows admin to verify their PDF template has correctly named fields

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-compliance-documents/index.ts` | Fix relationship query, add pdf-lib processing, upload generated PDF |

### New Dependencies in Edge Function

```typescript
import { PDFDocument } from 'https://cdn.skypack.dev/pdf-lib@1.17.1?dts';
```

### Placeholder Mapping (Already Implemented)

The edge function already collects this data:
- `{{customer_name}}` - Customer's full name
- `{{customer_email}}` - Customer's email
- `{{customer_phone}}` - Customer's phone
- `{{project_address}}` - Job site address
- `{{estimate_total}}` - Formatted total (e.g., "$25,000.00")
- `{{deposit_amount}}` - Required deposit
- `{{scope_description}}` - Work scope text
- `{{salesperson_name}}` - Assigned salesperson
- `{{company_name}}`, `{{company_address}}`, `{{company_phone}}`, `{{company_license}}` - Company info
- `{{current_date}}`, `{{expiration_date}}` - Dates
- `{{line_items}}`, `{{payment_schedule}}` - Itemized lists
- `{{terms_and_conditions}}`, `{{notes}}` - Additional text

---

## Questions to Clarify

Before implementing Phase 2, I need to know:

1. **Does your uploaded PDF have fillable form fields?** 
   - Open the PDF in Adobe Reader - can you click into text areas and type?
   - If yes, what are the field names?

2. **Or does it have literal placeholder text like `{{customer_name}}`?**
   - If yes, we'll need to explore external PDF services

3. **Would you like me to first fix the bug (Phase 1) so the basic flow works, then we can tackle the actual replacement?**

---

## Immediate Next Step

Fix the edge function bug so you can test the end-to-end flow (even without full replacement, it will link the template to the estimate and show it in the portal).

