

## Analysis: Cross-Company Payment Linkage Bug

You're right — these are two completely different companies:
- **CA Pro Builders** (`00000000-...0002`) — project "Karin Beck & Cellin P Gluck" at 922 Hartzell St
- **Demo Co #1** (`d95f6df1-...`) — replicated copy of the same project

**What happened:** Payment `b9adb32b` belongs to Demo Co #1 but its `invoice_id` points to CA Pro Builders' invoice (`9265fe23`). The DB trigger `update_invoice_payment_totals` sums ALL payments on that invoice regardless of company, so it shows $24,000 instead of $12,000.

**Root cause:** The `replicate-company-data` edge function. When it copies payments, it spreads `...rest` (which includes the original `invoice_id`) and then overrides with the mapped value. If the invoice mapping fails for any reason, the original source company's `invoice_id` leaks through because `undefined || null` evaluates to `null` but the spread already set the field. However, the actual data shows the original UUID — meaning either:
1. The replication ran before the invoice was replicated (ordering bug), or
2. A subsequent QB sync/webhook re-linked the payment to the source invoice

**Additionally:** The `quickbooks-fetch-invoice` and `quickbooks-webhook` functions have fallback matching by `invoice_number` that doesn't always filter by `company_id`, which could cause similar cross-company collisions.

## Plan

### Step 1: Fix the data
- Re-link payment `b9adb32b` to Demo Co #1's invoice `06b6687c` (or set to `null`)
- The trigger will automatically recalculate `payments_received` on both invoices

### Step 2: Fix `replicate-company-data` payment replication
- Destructure `invoice_id` out of `rest` explicitly (alongside `id`) so the spread can never leak the source invoice ID
- Same treatment for `project_id` and `bank_id` — destructure them out of `rest` to prevent any leakage

### Step 3: Harden `quickbooks-fetch-invoice` fallback matching
- In the `update-existing` action's fallback matching by `invoice_number` (line 347-364), ensure `.eq("company_id", companyId)` is always present (it already is, so this is confirmed safe)
- Add a log warning when `.maybeSingle()` returns null despite a match existing in another company, to catch future cross-company collisions

### Step 4: Harden `quickbooks-webhook` delete fallback
- In the invoice delete handler (line 394-400), the `invoice_number` fallback already filters by `company_id` — confirm and add a defensive log

