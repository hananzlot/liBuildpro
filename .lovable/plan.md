

## Phase 1a: Add 5 Missing UUID Columns

### Current State (confirmed via database query)

| Table | Has `contact_uuid`? | Has `opportunity_uuid`? |
|---|---|---|
| `conversations` | No | N/A |
| `call_logs` | No | N/A |
| `tasks` | No | No |
| `project_costs` | N/A | No |

### Migration SQL

```sql
-- 1. conversations: add contact_uuid
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS contact_uuid uuid REFERENCES public.contacts(id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_uuid ON public.conversations(contact_uuid);

-- 2. call_logs: add contact_uuid
ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS contact_uuid uuid REFERENCES public.contacts(id);
CREATE INDEX IF NOT EXISTS idx_call_logs_contact_uuid ON public.call_logs(contact_uuid);

-- 3. tasks: add contact_uuid and opportunity_uuid
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS contact_uuid uuid REFERENCES public.contacts(id),
  ADD COLUMN IF NOT EXISTS opportunity_uuid uuid REFERENCES public.opportunities(id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact_uuid ON public.tasks(contact_uuid);
CREATE INDEX IF NOT EXISTS idx_tasks_opportunity_uuid ON public.tasks(opportunity_uuid);

-- 4. project_costs: add opportunity_uuid
ALTER TABLE public.project_costs
  ADD COLUMN IF NOT EXISTS opportunity_uuid uuid REFERENCES public.opportunities(id);
CREATE INDEX IF NOT EXISTS idx_project_costs_opportunity_uuid ON public.project_costs(opportunity_uuid);
```

### What this does
- Adds 5 nullable UUID columns across 4 tables
- Each column is a proper foreign key pointing to the parent table's `id` (primary key)
- Creates indexes on each new column for query performance
- All columns start as NULL — no data is modified

### What this does NOT do
- No data backfill (next step)
- No NOT NULL constraint changes on legacy columns (later step)
- No code changes

### No code changes needed
This is schema-only. The new columns will appear in the Supabase types after regeneration but won't affect existing functionality since they're all nullable.

