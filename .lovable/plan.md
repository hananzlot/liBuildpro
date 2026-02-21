

## Dismiss/Snooze Stale Opportunity Notifications

### Problem
Currently, stale opportunity notifications reappear after being marked as read because the edge function's dedup check only looks for `read = false`. Once read, a new notification gets created on the next hourly run.

### Solution
Add dismiss and snooze capabilities to notifications so users can permanently dismiss or temporarily hide specific alerts.

### Changes

**1. Database Migration**
Add two columns to the `notifications` table:
- `dismissed_at` (timestamptz, nullable) -- when set, notification is permanently dismissed
- `snoozed_until` (timestamptz, nullable) -- when set, notification is hidden until this time

**2. Edge Function Update (`generate-productivity-notifications/index.ts`)**
Update the dedup logic for stale opportunities (and all other types) to also skip creating new notifications when an existing one with the same `appointment_ghl_id` has been dismissed or snoozed (not just unread ones). Specifically:
- Remove the `.eq("read", false)` filter from the stale opportunity dedup query (line 170)
- Instead, check for any existing notification with the same dedup key that is either unread, dismissed, or snoozed into the future
- Apply the same pattern to bill_due dedup (line 219) which also currently filters on `read = false`

**3. Hook Update (`src/hooks/useNotifications.ts`)**
- Filter out dismissed and snoozed notifications from the fetched list
- Add `dismissNotification` mutation (sets `dismissed_at = now()`)
- Add `snoozeNotification` mutation (sets `snoozed_until` to a chosen future time, e.g., 24h, 3 days, 7 days)
- Export these new mutations

**4. UI Update (`src/components/dashboard/NotificationBell.tsx`)**
- Add a small dropdown menu (three-dot or right-click) on each notification row with:
  - "Dismiss" -- hides the notification permanently
  - "Snooze 1 day" / "Snooze 3 days" / "Snooze 7 days" -- hides until the selected time
- Only show dismiss/snooze options for actionable types (stale_opportunity, overdue_task, overdue_invoice, bill_due)
- Show a subtle "Dismissed" or "Snoozed until..." indicator if needed

### Technical Details

**Migration SQL:**
```sql
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;
```

**Edge function dedup change (stale opportunities and bills):**
Replace the current `.eq("read", false)` with a broader check -- query for any existing notification with the same dedup key (regardless of read status). This prevents re-creation after dismiss or read.

**Notification filtering in hook:**
```typescript
// Filter out dismissed and currently-snoozed notifications
.is("dismissed_at", null)
.or("snoozed_until.is.null,snoozed_until.lt." + new Date().toISOString())
```

