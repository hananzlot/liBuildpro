## Plan: Revamp Salesperson Portal Estimate Creator

This is a significant refactor of the `PortalEstimateCreator` component to modernize linking, add manual estimate creation, and support change orders.

### Current State
- Links use a mix of UUIDs and GHL IDs (`opportunity_id`, `contact_id`)
- No check for existing projects when selecting an opportunity
- Only AI estimate creation path exists
- No manual estimate creation (total, estimated cost, progress payments)
- No change order awareness (signed contract detection)

### Database Changes

**Migration: Add `estimated_cost` column to `estimates` table**
```sql
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS estimated_cost numeric;
```

The `estimate_payment_schedule` table already exists with `estimate_id`, `phase_name`, `amount`, `percent`, `sort_order` — perfect for storing manual progress payments.

### Implementation Steps

#### 1. Remove GHL ID linking, use UUIDs only
- Stop passing `opportunityGhlId`, `contactId` (GHL) to `create-portal-estimate`
- Only pass `opportunityUuid`, `contactUuid`, `projectId` (all internal UUIDs)
- Update `create-portal-estimate` edge function to stop writing `opportunity_id` and `contact_id` GHL fields — use only UUID columns

#### 2. Check for existing project when selecting an opportunity
- On opportunity selection, query `projects` table for `opportunity_uuid = selectedOppId` where `project_status NOT IN ('Completed', 'Cancelled')` and `deleted_at IS NULL`
- If a project exists: show an alert saying "This customer already has Project #X on file" and auto-switch to project association (store the `project_id`)
- The estimate will then link to the project UUID via `project_id` column

#### 3. Check for signed contract (Change Order detection)
- When an opportunity/project is selected, query `project_agreements` for the linked project where `agreement_type = 'Contract'`
- If a signed contract exists:
  - Change the card title to "Create Change Order"
  - The estimate title defaults to "Change Order for [Customer]"
  - Button labels become "Prepare Change Order by AI" and "Prepare Change Order Manually"
- If no signed contract: standard "Create Estimate" labels

#### 4. Restructure the flow into steps
After selection (Step 1), show:
- **Step 2**: Work scope textarea (already exists, keep it)
- **Step 3**: Two buttons side by side:
  - "Prepare with AI" (or "Prepare Change Order by AI") — current AI workflow
  - "Prepare Manually" (or "Prepare Change Order Manually") — new manual workflow

#### 5. Manual estimate creation flow
When "Prepare Manually" is clicked, expand a form below with:
- **Estimate Total Price** (`Input`, number) → saved to `estimates.total` and `estimates.manual_total`
- **Estimated Costs** (`Input`, number) → saved to `estimates.estimated_cost` (new column)
- **Progress Payments** — dynamic list (up to 10 rows):
  - Each row: Phase Name (`Input`) + Amount (`Input`, number)
  - Running total displayed, with validation:
    - If sum != Estimate Total: show warning in amber
    - Disable submit until sum matches
  - "Add Payment" button to add rows
- **Submit button** ("Create Estimate" / "Create Change Order"):
  - Creates estimate record in DB (via `create-portal-estimate` edge function or direct insert)
  - Inserts rows into `estimate_payment_schedule`
  - Does NOT trigger AI generation

#### 6. Proposal preview before sending
- In `PortalEstimateDetailSheet`, before the "Send as Proposal" action completes, show the `EstimatePreviewDialog` first
- Add a confirmation step: "Preview" → "Confirm & Send"
- This already partially exists (there's a View button with `EstimatePreviewDialog`); wire the send flow through it

#### 7. Update `create-portal-estimate` edge function
- Accept optional `projectId` parameter
- Write `project_id` to the estimate when provided
- Accept `isManual` flag — when true, skip AI job creation
- Accept `estimatedCost` — write to new `estimated_cost` column
- Stop writing GHL ID fields (`opportunity_id`, `contact_id`) — use only UUID columns

### Files to Modify
1. **`src/components/salesperson-portal/PortalEstimateCreator.tsx`** — Major refactor: UUID-only linking, project detection, change order awareness, manual creation form, two-button flow
2. **`supabase/functions/create-portal-estimate/index.ts`** — Add `projectId`, `isManual`, `estimatedCost` params; remove GHL ID writes; conditionally skip AI job
3. **`src/components/salesperson-portal/PortalEstimateDetailSheet.tsx`** — Add preview-before-send confirmation flow
4. **New migration** — Add `estimated_cost` column to `estimates`

### Summary of User-Facing Changes
- Selecting an opportunity auto-detects if a project already exists and alerts the sales rep
- If a signed contract exists on the project, labels switch to "Change Order" terminology
- After entering work scope, two clear paths: AI or Manual
- Manual path collects total price, estimated costs, and progress payments with live validation
- Before sending a proposal, the sales rep sees a preview and must confirm

## Plan: Respect `auto_sync_to_quickbooks` in QB Webhooks + Re-sync on Re-enable

### Status: ✅ Implemented

### What was built

#### Part 1: Gate inbound webhooks by project auto-sync flag
- Added `getProjectAutoSyncStatus()` helper in `quickbooks-webhook/index.ts`
- Before processing any Create/Update/Delete, checks the associated project's `auto_sync_to_quickbooks` flag
- If disabled, skips processing and logs `queued_while_paused` status in `quickbooks_sync_log`
- Lookup paths: Invoice→project_invoices, Payment→project_payments, Bill→project_bills, BillPayment→bill_payments→project_bills

#### Part 2: Review dialog on re-enable (cherry-pick sync entries)
- When toggling auto-sync ON, if queued entries exist, a full-screen **QueuedSyncReviewDialog** opens
- Toggle is **blocked** until user reviews — auto-sync only enables after confirmation
- Shows all queued entries with enriched details (invoice #, amounts, bill refs, etc.)
- User can check/uncheck entries individually or use Select All / Deselect All
- **Approved entries** → marked `pending_refresh` for next sync
- **Dismissed entries** → marked `sync_dismissed` with `dismissed_by` (user UUID) and `dismissed_at` (timestamp) for audit

#### Part 3: Skipped Sync section in Finance tab
- `SkippedSyncEntries` component rendered below the Finance tabs when QB is connected
- Shows all `sync_dismissed` entries for the project in a collapsible section
- Each entry shows type badge, description, amount, dismissal date, and who dismissed it
- **Undo button** allows restoring a dismissed entry to `pending_refresh` with confirmation dialog

### Migration
- Added `dismissed_by` (uuid FK → auth.users) and `dismissed_at` (timestamptz) to `quickbooks_sync_log`

### Files Created/Modified
- `supabase/functions/quickbooks-webhook/index.ts` — added auto-sync gate
- `src/components/production/QueuedSyncReviewDialog.tsx` — new review dialog
- `src/components/production/SkippedSyncEntries.tsx` — new skipped entries section
- `src/components/production/ProjectDetailSheet.tsx` — wired toggle to review flow
- `src/components/production/FinanceSection.tsx` — added SkippedSyncEntries import/render
