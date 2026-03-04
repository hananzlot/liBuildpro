

## Investigation Findings

### Issue 1: Contract PDF doesn't show signature records/image

The contract PDF for Veronica Foreman (estimate `d7b007d5`, CNT-2106) has **zero signature records** in the `estimate_signatures` table. The `generate-contract-pdf` edge function queries `estimate_signatures` for the estimate (line 48) and embeds them into the PDF (lines 816-895). Since there are no signatures, the PDF correctly shows none.

**Root cause**: This agreement was created manually by an admin (via the Finance/Agreement section), not through the customer portal signing flow. The admin uploaded a PDF contract directly. The portal signing flow is what creates `estimate_signatures` records and embeds them into the generated PDF. Since the customer never signed through the portal, no signature data exists.

### Issue 2: Proposal not marked as "accepted"

The estimate status is `sent` and `signed_at` is null. The estimate is only marked `accepted` when a customer signs through the portal (in `PortalEstimateView.tsx`, lines 536-541 or 594-600). Since this contract was created manually by the admin, the signing flow was bypassed entirely.

---

## Proposed Fix

**When an admin manually creates an Agreement of type "Contract" linked to an estimate, the system should automatically mark the corresponding estimate as `accepted`.**

### Changes

1. **`src/components/production/FinanceSection.tsx`** — In the agreement save handler, after successfully inserting a new agreement of type `Contract`:
   - Query for the estimate linked to this project (matching by estimate_number from the agreement_number pattern, or the first `sent` estimate)
   - Update the estimate's `status` to `accepted` and set `signed_at` to the `agreement_signed_date`

2. **One-time data fix (migration)** — For the Veronica Foreman estimate specifically:
   - Update estimate `d7b007d5-1cc4-4940-aaa2-6b9522e08e4a` to `status: 'accepted'` and `signed_at: '2026-02-27'`

### Regarding the PDF not showing signatures

Since this was a manually uploaded PDF contract (not generated through the portal signing flow), there are no digital signatures to display. The existing PDF attachment on the agreement is the actual signed document. This is working as designed — the `generate-contract-pdf` function is meant for portal-signed contracts. If you need the agreement PDF to show signature data, the customer would need to sign through the portal, or you would need to manually add signature records. 

**The practical fix is**: mark the estimate as accepted (both retroactively for this record and proactively for future manual agreements).

