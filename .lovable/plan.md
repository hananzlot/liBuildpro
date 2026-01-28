
# Plan: Make Tasks and Notes Fully Independent of GHL

## Summary

Refactor the task and note creation/update/deletion flow to be completely local (Supabase-only). GHL IDs will remain optional metadata for records that were originally synced FROM GHL, but all new records created in the app will be stored locally without any attempt to sync to GHL.

---

## Current Problem

The error `GHL API Error: 422 - The assigned to field is invalid` occurs because:
1. The `create-ghl-task` edge function attempts to sync tasks to GoHighLevel when GHL credentials exist
2. The `assignedTo` field contains an internal Supabase UUID (user's profile ID), but GHL expects a GHL User ID
3. This mismatch causes the GHL API to reject the request

The same pattern exists in `create-contact-note`, which also attempts GHL sync.

---

## Proposed Changes

### 1. Edge Function: `create-ghl-task/index.ts`
**Goal**: Create tasks locally only - never sync to GHL

**Changes**:
- Remove all GHL API call logic (lines 142-208)
- Always use the local-only creation path
- Keep the `ghl_id` field populated with a local ID (e.g., `local_task_...`) for backwards compatibility
- Set `provider` to `'local'` for all new tasks
- Remove the `getGHLApiKey` lookup since it's no longer needed for task creation

### 2. Edge Function: `create-contact-note/index.ts`
**Goal**: Create notes locally only - never sync to GHL

**Changes**:
- Remove GHL API call logic (lines 100-143)
- Always use the local-only creation path (similar to how local contacts are handled)
- Generate a `local_note_...` ID for the `ghl_id` field
- Set `provider` to `'local'` for all new notes

### 3. Edge Function: `update-ghl-task/index.ts`
**Goal**: Update tasks locally only - never sync to GHL

**Changes**:
- Remove GHL API call logic (lines 117-152)
- Always use the local-only update path
- Keep edit tracking functionality (`edited_by`, `edited_at`)

### 4. Edge Function: `delete-ghl-task/index.ts`
**Goal**: Delete tasks locally only - never sync to GHL

**Changes**:
- Remove GHL API call logic (lines 106-131)
- Always use the local-only delete path

### 5. Frontend: `OpportunitiesTable.tsx`
**Goal**: Simplify task/note creation - remove GHL-specific logic

**Changes**:
- Remove hardcoded location ID fallbacks (line 793: `"pVeFrqvtYWNIPRIi0Fmr"`)
- Simplify the edge function calls - no need to pass `locationId` for GHL purposes
- The `assignedTo` field should use internal UUIDs (which it already does)

---

## Technical Details

### Task Creation Flow (After Changes)
```text
User clicks "Add Task" 
  → Frontend sends: { contactId, title, body, dueDate, assignedTo, companyId, enteredBy }
  → Edge function generates local ID: "local_task_1706547841234_abc123"
  → Insert directly into ghl_tasks table with provider='local'
  → Return success to frontend
```

### Note Creation Flow (After Changes)
```text
User clicks "Add Note"
  → Frontend sends: { contactId, body, companyId, enteredBy }
  → Edge function generates local ID: "local_note_1706547841234_xyz789"
  → Insert directly into contact_notes table with provider='local'
  → Return success to frontend
```

### Data Model Compatibility
- The `ghl_id` column already allows NULL and is not required to be a real GHL ID
- The `provider` column (`'ghl'` or `'local'`) already exists and will distinguish record sources
- Existing records synced from GHL will retain their original `ghl_id` values
- New records will have `local_...` prefixed IDs

---

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/functions/create-ghl-task/index.ts` | Simplify | Remove GHL sync, always create locally |
| `supabase/functions/create-contact-note/index.ts` | Simplify | Remove GHL sync, always create locally |
| `supabase/functions/update-ghl-task/index.ts` | Simplify | Remove GHL sync, always update locally |
| `supabase/functions/delete-ghl-task/index.ts` | Simplify | Remove GHL sync, always delete locally |
| `src/components/dashboard/OpportunitiesTable.tsx` | Minor | Remove hardcoded location ID fallback |

---

## Benefits

1. **Reliability**: No more GHL API errors when creating tasks/notes
2. **Performance**: Faster task/note creation (no external API call)
3. **Independence**: App functionality works regardless of GHL integration status
4. **Consistency**: All activity created in the app follows the same local-first pattern
5. **Simplicity**: Cleaner edge function code with single code path

---

## What Remains GHL-Connected

- **Contacts sync**: GHL → Supabase (via `sync-ghl-recent`)
- **Opportunities sync**: GHL → Supabase (via `sync-ghl-recent`)
- **Appointments sync**: GHL ↔ Supabase (bidirectional for calendar)
- **Task sync FROM GHL**: `sync-ghl-tasks` can still pull task status updates from GHL to Supabase
