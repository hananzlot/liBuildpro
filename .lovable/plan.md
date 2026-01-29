

# Plan: Add Compliance Package Toggle + Fix All Bugs

## Summary

This plan adds a company-level setting to enable/disable the compliance document workflow, plus fixes three critical bugs preventing the flow from working correctly.

---

## Bugs to Fix

### Bug 1: "No Documents" Case Doesn't Advance Flow

**Location:** `src/components/portal/ComplianceSigningFlow.tsx` (lines 269-285)

**Problem:** When no compliance templates are configured for a company, clicking "Continue" only closes the dialog via `onOpenChange(false)` but never calls `onAllSigned()`. This leaves the user stuck - they have to manually click the button again.

**Fix:** Change the Continue button to call `onAllSigned()` before closing:
```javascript
<Button onClick={() => {
  onAllSigned(); // Advance the flow
  onOpenChange(false);
}}>
  Continue
</Button>
```

---

### Bug 2: Edge Function Uses Wrong Table Schema

**Location:** `supabase/functions/generate-compliance-documents/index.ts` (lines 418-446)

**Problem:** The function attempts to insert into `signature_documents` table with columns that don't exist:
- `document_type` - DOES NOT EXIST in signature_documents
- `template_id` - DOES NOT EXIST in signature_documents  
- `file_url` - DOES NOT EXIST (it's `document_url`)
- `file_name` - DOES NOT EXIST
- `linked_estimate_id` - DOES NOT EXIST

This causes a PGRST204 error and fails silently.

**Fix:** Remove this entire block (lines 418-446). The compliance signing workflow is handled entirely through `estimate_compliance_documents` and `signed_compliance_documents` tables. The `signature_documents` table is for a different feature.

---

### Bug 3: Table Mismatch in Query Logic

**Location:** `src/components/portal/ComplianceSigningFlow.tsx` (lines 88-185)

**Problem:** The component queries `signed_compliance_documents` first, but the edge function writes generated documents to `estimate_compliance_documents`. When there are no existing records in `signed_compliance_documents`, it:
1. Calls the edge function to generate
2. Creates records in `signed_compliance_documents` using data from the generate result
3. But if the generate result doesn't match expectations, it fails

**Current Flow:**
```text
1. Query signed_compliance_documents (empty)
2. Call edge function (writes to estimate_compliance_documents) 
3. Try to create signed_compliance_documents using result
4. Result may be empty or mismatched -> no documents shown
```

**Fix:** Improve the logic to:
1. First check for existing `signed_compliance_documents`
2. If none exist, check `estimate_compliance_documents` for generated docs
3. If generated docs exist, use those URLs to create the signing records
4. If no templates at all, proceed immediately (call onAllSigned)

---

## New Feature: Compliance Package Toggle

### Overview

Add a company-level setting `compliance_package_enabled` (default: `false`) that controls whether the compliance document signing workflow is active.

| Setting Value | Behavior |
|---------------|----------|
| `false` (default) | Skip compliance flow, go directly to proposal signature |
| `true` | Show compliance documents, require signing before proposal |

---

### Implementation Details

#### Step 1: Add Toggle to Admin Settings

**File:** `src/components/admin/ComplianceTemplatesManager.tsx`

Add a toggle switch at the top of the card:

```text
+--------------------------------------------------+
| Compliance Document Templates        [Add Template]
+--------------------------------------------------+
| Enable Compliance Signing Workflow      [Toggle] |
| When enabled, customers must sign all compliance |
| documents before signing the main proposal.      |
+--------------------------------------------------+
| [Template list...]                               |
+--------------------------------------------------+
```

The toggle will:
- Query `company_settings` for `compliance_package_enabled`
- Default to `false` if not set
- Save changes immediately on toggle

#### Step 2: Update Portal Logic

**File:** `src/components/portal/PortalEstimateView.tsx`

1. Fetch the `compliance_package_enabled` setting in the portal data query
2. Update the button click handler:

```javascript
onClick={() => {
  // Only show compliance flow if enabled AND not multi-signer
  if (!complianceComplete && !portalData.isMultiSigner && compliancePackageEnabled) {
    setComplianceFlowOpen(true);
  } else {
    setSignatureDialogOpen(true);
  }
}}
```

3. Update button text:
   - When `compliance_package_enabled = false`: "Sign Proposal"
   - When `compliance_package_enabled = true`: "Approve & Sign Documents"

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/ComplianceTemplatesManager.tsx` | Add toggle at top of card with query/mutation |
| `src/components/portal/ComplianceSigningFlow.tsx` | Fix "no docs" case to call onAllSigned, improve query logic |
| `src/components/portal/PortalEstimateView.tsx` | Fetch setting, conditionally bypass compliance flow, update button text |
| `supabase/functions/generate-compliance-documents/index.ts` | Remove broken signature_documents insert block |

---

## Technical Notes

### No Database Migration Required

The `company_settings` table already supports arbitrary key-value pairs. No schema changes needed.

### Backward Compatibility

Since the default is `false`, all existing portals will continue working with the regular signature flow. The compliance workflow only activates when explicitly enabled.

### Multi-Signer Mode

The compliance flow already skips for multi-signer mode (this is existing behavior). This plan doesn't change that.

---

## Testing Checklist

After implementation:

1. **Toggle Off (default)**
   - Open proposal in portal
   - Click accept button
   - Signature dialog should open directly (no compliance flow)
   - Button text should say "Sign Proposal"

2. **Toggle On + No Templates**
   - Enable toggle in admin settings
   - Open proposal in portal
   - Click accept button
   - Should show "No Documents Required" briefly then auto-open signature dialog

3. **Toggle On + Templates Configured**
   - Add compliance template in admin settings
   - Open proposal in portal
   - Click accept button
   - Compliance documents list should appear
   - Sign each document
   - Main signature dialog should open automatically

