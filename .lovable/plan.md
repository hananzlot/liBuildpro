

## Backfill Single Conversation Record

**What we'll do**: Update one row in `conversations` to set `contact_uuid` from the matching contact.

**SQL (data update via insert tool)**:
```sql
UPDATE conversations
SET contact_uuid = 'c44d5dd3-1c2c-4bc4-8465-bb347a2ef6ec'
WHERE id = '0ed5ad82-eb3f-411d-ade4-b9ae2464a7fd';
```

**Record being updated**:
- **Conversation ID**: `0ed5ad82-eb3f-411d-ade4-b9ae2464a7fd`
- **Legacy contact_id**: `BqPEbSOXMSQjxQw0Pqx0`
- **New contact_uuid**: `c44d5dd3-1c2c-4bc4-8465-bb347a2ef6ec` (Jj Rod)

**No code changes** — this is a single data update so you can verify the UI behavior.

