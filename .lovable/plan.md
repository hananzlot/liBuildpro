

# Auto-Save Proposal PDF on Send

## Overview
When a proposal is sent, automatically generate and save a full PDF snapshot. The customer portal then simply displays the saved PDF instead of dynamically rendering the proposal. This ensures the customer always sees the exact version that was sent, and eliminates the need for the portal to assemble data from multiple tables.

## How It Works Today
1. The "Send Proposal" flow emails a portal link to the customer
2. The portal dynamically fetches estimate data from ~6 tables and renders it using `ProposalContent`
3. PDF generation only happens on-demand when someone clicks "View PDF"
4. The PDF edge function (`generate-contract-pdf`) already builds a complete PDF and uploads it to the `contracts` storage bucket

## What Changes

### 1. Database: Add `proposal_pdf_url` column to `estimates`
- Add a nullable TEXT column `proposal_pdf_url` to the `estimates` table
- This stores the public URL of the saved PDF snapshot

### 2. Send Proposal Flow: Auto-generate PDF on send
- In `SendProposalDialog.tsx`, after successfully sending the proposal email, call `generate-contract-pdf` in the background
- Save the returned URL to `estimates.proposal_pdf_url`
- This happens silently -- the user doesn't need to wait for it

### 3. Customer Portal: Show saved PDF
- In `PortalProposals.tsx`, check if `proposal_pdf_url` exists on the estimate
- If it does, show a prominent "View Proposal PDF" button that opens the saved PDF directly (no generation delay)
- Keep the existing dynamic detail view as a fallback for older proposals that don't have a saved PDF
- Remove the on-demand "View PDF" generation button when a saved PDF already exists

### 4. Edge Function: Add missing sections to PDF
- Update `generate-contract-pdf` to include the Insurance Docs, License/Certificate files, and Attached Documents sections that are currently missing from the PDF output
- This ensures the saved PDF is a complete representation matching the web view

## Technical Details

### Database Migration
```sql
ALTER TABLE public.estimates
ADD COLUMN proposal_pdf_url TEXT;
```

### Files Modified
- `supabase/migrations/` -- new migration for `proposal_pdf_url` column
- `src/components/estimates/SendProposalDialog.tsx` -- trigger PDF generation after send
- `src/components/portal/tabs/PortalProposals.tsx` -- use saved PDF URL when available
- `supabase/functions/generate-contract-pdf/index.ts` -- add insurance/license/attached docs sections

### Flow Diagram

```text
Send Proposal clicked
       |
       v
  Email sent to customer
       |
       v
  generate-contract-pdf called (background)
       |
       v
  PDF saved to contracts bucket
       |
       v
  estimates.proposal_pdf_url updated
       |
       v
  Customer opens portal --> sees "View PDF" button --> instant PDF load
```

### Edge Cases
- **Older proposals**: No `proposal_pdf_url` set -- portal falls back to dynamic rendering + on-demand PDF generation (current behavior)
- **Estimate edited after send**: If admin edits and resends, a new PDF is generated and the URL is updated
- **PDF generation failure**: Logged but does not block the send flow; portal falls back to dynamic view
