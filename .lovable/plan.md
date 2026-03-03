

## Plan: Delete All Demo Co Estimates and Proposals

**Company**: Demo Co #1 (`d95f6df1-ef3c-4e12-8743-69c6bfb280bc`)

### Current State
- **42 estimates** — all with zero groups and zero line items (empty shells)
- **0 portal tokens** referencing these estimates
- **0 generation jobs** referencing these estimates
- **16 projects** linked to these estimates

### Deletion Steps (executed via Supabase data operations)

1. **Delete `estimate_line_items`** for Demo Co estimates (currently 0, but included for safety)
2. **Delete `estimate_groups`** for Demo Co estimates (currently 0, same reason)
3. **Delete `estimates`** where `company_id = 'd95f6df1-...-69c6bfb280bc'` — removes all 42 records
4. **Update linked projects** — clear `project_status` back or leave as-is (the projects themselves remain; only the estimate records are removed)

### What This Does NOT Touch
- Projects themselves remain intact (only estimate records are deleted)
- No other company's data is affected
- No schema changes required

### Technical Details
- Deletions use the Supabase insert/data tool (DELETE statements)
- Order matters: child tables first (line items → groups → estimates) to avoid FK violations
- All scoped by `company_id` to ensure strict tenant isolation

