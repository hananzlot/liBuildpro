

## Plan: Respect `auto_sync_to_quickbooks` in QB Webhooks + Re-sync on Re-enable

### Problem

Two issues identified:

1. **Inbound webhooks ignore project auto-sync flag**: The `quickbooks-webhook` function processes all entity changes (create/update/delete) regardless of whether the associated project has `auto_sync_to_quickbooks = false`. This means QB-side changes still modify local records for projects that should not be syncing.

2. **No catch-up mechanism on re-enable**: When auto-sync is turned back on, outbound unsynced records will sync on next "Sync Now", but inbound QB changes that occurred during the off period are lost (webhooks already fired and were processed or missed).

### Proposed Solution

#### Part 1: Gate inbound webhooks by project auto-sync flag

In `supabase/functions/quickbooks-webhook/index.ts`, inside `processEntityChange()`:

- After finding the `syncLog` entry (which contains `record_id`), look up the associated project's `auto_sync_to_quickbooks` flag
- For records linked to a project with `auto_sync_to_quickbooks = false`:
  - **Skip** processing the webhook change
  - Log a `queued_while_paused` status in `quickbooks_sync_log` so it can be replayed later
- For **Create** operations (new QB entities with no sync log): still skip import if the target project can be identified and has auto-sync off; otherwise log for later processing

The lookup path varies by entity type:
- Invoice → `project_invoices.project_id → projects.auto_sync_to_quickbooks`
- Payment → `project_payments.project_id → projects.auto_sync_to_quickbooks`
- Bill → `project_bills.project_id → projects.auto_sync_to_quickbooks`
- BillPayment → `bill_payments.bill_id → project_bills.project_id → projects.auto_sync_to_quickbooks`

For new creates where no local record exists yet, the webhook cannot determine the project — these will continue to import as-is (since there's no project association to check against).

#### Part 2: Replay queued changes when auto-sync is re-enabled

When `auto_sync_to_quickbooks` is toggled from `false` to `true` on a project:

- Add logic in the client (or a small edge function) to find any `quickbooks_sync_log` entries with `sync_status = 'queued_while_paused'` for records belonging to that project
- Re-trigger the appropriate fetch functions for those queued entries
- This ensures no QB changes are lost during the paused period

### Files/Tables Affected

- `supabase/functions/quickbooks-webhook/index.ts` — add project auto-sync check in `processEntityChange()`
- `quickbooks_sync_log` table — new status value `queued_while_paused`
- `src/components/production/FinanceSection.tsx` — optionally trigger catch-up sync when auto-sync is re-enabled

### Risks

- **Performance**: Each webhook event will now require an additional DB query to look up the project's auto-sync status. Mitigated by the fact that we already query `quickbooks_sync_log` per entity.
- **New creates without project association**: For newly created QB entities with no local record, we can't determine the project. These will still be imported. This is acceptable since the project mapping happens during import.
- **Migration**: Existing `sync_status` values don't include `queued_while_paused`. This is additive (text column), no migration needed.

### Implementation Steps

1. Update `processEntityChange()` in `quickbooks-webhook` to check project auto-sync flag before processing
2. Add `queued_while_paused` sync log entries for skipped webhook events
3. Add catch-up logic when `auto_sync_to_quickbooks` is toggled back on
4. Deploy updated edge function

