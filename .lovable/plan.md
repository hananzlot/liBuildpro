

## Enhanced Notification Bell for Productivity

### Overview
Expand the notification bell from appointment-only reminders to surface 5 types of actionable productivity alerts, with UI improvements for categorization and navigation.

### Notification Types

**1. Overdue Invoice Alerts (A/R Collections)**
- Query `project_invoices` for invoices 30, 60, or 90+ days past due with open balance > 0
- Show customer name, project, amount, and days overdue
- Clicking navigates to the project's invoice detail

**2. Overdue Task Reminders (In-App Tasks Only)**
- Query `ghl_tasks` filtered to `provider = 'local'` only (NOT GHL-synced tasks)
- Find tasks where `due_date < now()` and `completed = false`
- Daily digest: "You have X overdue in-app tasks"
- Clicking navigates to the relevant opportunity/contact

**3. Stale Opportunity Alerts**
- Flag opportunities not updated in 7+ days (configurable)
- Prompt the assigned rep to follow up or update the status

**4. Unpaid Bills Due Soon (A/P Reminders)**
- Query `project_bills` for bills approaching or past their due date with balance > 0
- Show vendor name, amount, and due date

**5. Proposal Activity**
- Notify when estimates are accepted or declined
- Link to the estimate/project detail

---

### Database Changes

Add a `reference_url` column to the `notifications` table so each notification can deep-link to the relevant page:

```sql
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS reference_url text;
```

---

### New Edge Function: `generate-productivity-notifications`

- Scheduled to run periodically (e.g., every hour via pg_cron)
- For each company, queries:
  - `project_invoices` for overdue A/R
  - `ghl_tasks` WHERE `provider = 'local'` AND `completed = false` AND `due_date < now()` for overdue in-app tasks
  - `opportunities` WHERE `updated_at < now() - interval '7 days'` for stale leads
  - `project_bills` WHERE `balance > 0` AND due date approaching/past
- Deduplication: before inserting, checks if a notification for the same item already exists (using `appointment_ghl_id` or a new reference field) to avoid duplicates
- Inserts into the existing `notifications` table with new `type` values: `overdue_invoice`, `overdue_task`, `stale_opportunity`, `bill_due`, `proposal_activity`
- Sets `reference_url` to the appropriate in-app route (e.g., `/projects/{id}`, `/opportunities/{id}`)

---

### Frontend Changes

**NotificationBell.tsx:**
- Add icon mapping per notification type (DollarSign for invoices, ClipboardList for tasks, AlertTriangle for stale leads, Receipt for bills, FileText for proposals)
- Add filter tabs at the top of the popover: All | Appointments | Financial | Tasks
- Make notifications clickable: use `react-router-dom`'s `useNavigate` to go to `reference_url` on click
- Add a "Today's Focus" summary line at the top showing counts by category
- Distinct accent colors per notification type

**useNotifications.ts:**
- No changes needed to the query itself (it already fetches all notification types)
- Optionally add a `type` filter parameter for the tab filtering

---

### Key Design Decision: Why Only Local Tasks

The `ghl_tasks` table contains both GHL-synced tasks (`provider = 'ghl'`) and in-app created tasks (`provider = 'local'`). Overdue notifications will only surface **locally created tasks** because:
- GHL tasks are managed in an external system with its own notification mechanisms
- In-app tasks are the ones users directly create and are responsible for within this application
- This avoids duplicate alerting for tasks already tracked in GoHighLevel

