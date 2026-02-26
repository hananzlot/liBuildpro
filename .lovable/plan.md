

## Plan: Change Archive to Record-Limit Based + Add Archive Viewer UI

### What Changes

**1. Database Migration**
- Replace the `archive_old_audit_logs` function: instead of archiving by retention days, it will archive the oldest records when `audit_logs` exceeds a configurable record limit (default 50,000). It keeps the newest N records and moves the rest to the archive.
- Add missing composite indexes on `archived_audit_logs`: `(company_id, changed_at DESC)`, `(table_name, record_id)`, `(action)`, `(user_email)`, `(record_id)` -- matching the main table's indexes for query parity.
- Update `app_settings`: replace `audit_log_retention_days` with `audit_log_max_records` (default 50000).

**2. Edge Function Update (`supabase/functions/archive-audit-logs/index.ts`)**
- Read `audit_log_max_records` from `app_settings` instead of `audit_log_retention_days`.
- Call the updated RPC with `p_max_records` instead of `p_retention_days`.

**3. Admin Settings UI (`src/pages/AdminSettings.tsx`)**

Archive Settings card changes:
- Replace "Retention Period (days)" input with "Max Active Records" input (default 50,000, min 1000, max 500,000).
- Update labels and description text accordingly.
- "Archive Now" button calls the updated RPC.

Add an "Archived Logs" viewer:
- Add a toggle/tab or a separate card below the Activity Log card labeled "Archived Logs".
- Same filter controls (date range, table, action, user) querying `archived_audit_logs` instead of `audit_logs`.
- Same paginated table (50 per page) with identical columns plus an "Archived At" column.
- Same detail dialog on row click.

### Technical Details

**New DB function signature:**
```sql
CREATE OR REPLACE FUNCTION public.archive_old_audit_logs(p_max_records INTEGER DEFAULT 50000)
RETURNS INTEGER
-- Counts current audit_logs rows
-- If count > p_max_records, moves the oldest (count - p_max_records) rows to archived_audit_logs
-- Returns number of rows archived
```

**New indexes on `archived_audit_logs`:**
```sql
CREATE INDEX idx_archived_audit_logs_company_changed ON archived_audit_logs (company_id, changed_at DESC);
CREATE INDEX idx_archived_audit_logs_table_record ON archived_audit_logs (table_name, record_id);
CREATE INDEX idx_archived_audit_logs_action ON archived_audit_logs (action);
CREATE INDEX idx_archived_audit_logs_user_email ON archived_audit_logs (user_email);
CREATE INDEX idx_archived_audit_logs_record_id ON archived_audit_logs (record_id);
```

**UI layout for Audit tab (top to bottom):**
1. Auto-Archive Settings card (max records input + Archive Now button)
2. Filters card (shared filters for both active and archived)
3. Activity Log card (current `audit_logs` table with pagination) -- unchanged
4. **New:** Archived Logs card (collapsible, queries `archived_audit_logs` with same filters + pagination, shows "Archived At" column)

**Files modified:**
- New SQL migration (via migration tool)
- `supabase/functions/archive-audit-logs/index.ts`
- `src/pages/AdminSettings.tsx`

