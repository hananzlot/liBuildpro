

## Dialog Persistence & Draft Saving — Implementation Plan

### Current State
- **Dialog stability on tab switch**: Already handled in `src/components/ui/dialog.tsx` — Radix `onOpenChange`, `onFocusOutside`, and `onInteractOutside` are intercepted to prevent closing when `document.visibilityState === "hidden"` or `!document.hasFocus()`. This means **dialogs already stay open on tab switch**.
- **Existing hook**: `src/hooks/usePersistedDialog.ts` exists (localStorage-based, 30min TTL) but is **unused** anywhere in the codebase.
- **No draft persistence** exists today.
- **76+ files** use `<Dialog>`, **26+ files** use `<AlertDialog>`. Refactoring all of them in one pass is not practical and risks introducing regressions across the entire app.

### Recommended Approach: Phased Rollout

Rather than touching all 100+ dialog instances at once, I recommend:

1. **Create the two reusable hooks** (universal, ready for any dialog)
2. **Apply to the highest-value form dialogs first** (the ones where losing draft data actually hurts)
3. **Leave simple confirmation/preview dialogs alone** (AlertDialogs for delete confirmation, image lightboxes, etc. don't need draft persistence)

### Implementation Steps

#### Step 1: Create `useModalQueryState` hook
**File**: `src/hooks/useModalQueryState.ts`

- Reads/writes `?modal=<key>&modalId=<recordId>` query params using `URLSearchParams` + `history.replaceState`
- Returns `{ open, setOpen, recordId }`
- On mount: if URL has matching `modal` param, return `open=true`
- On `setOpen(true)`: write params; on `setOpen(false)`: remove params
- Replace the existing unused `usePersistedDialog.ts` approach

#### Step 2: Create `usePersistentDraft` hook
**File**: `src/hooks/usePersistentDraft.ts`

- Key format: `draft:<modalKey>:<recordId|new>`
- Uses `sessionStorage` for fast read/write
- Debounced save (400ms) on value changes
- `loadDraft()` — returns saved draft or null
- `updateDraft(partial)` — merges and debounce-saves
- `clearDraft()` — removes from sessionStorage
- `isDirty` — boolean comparing current values to initial
- Returns `{ draft, updateDraft, clearDraft, isDirty }`

#### Step 3: Create `useDiscardConfirm` hook or utility
**File**: `src/hooks/useDiscardConfirm.ts`

- Small hook that wraps the close handler: if `isDirty`, show a confirmation AlertDialog before closing
- On confirm discard: `clearDraft()` + `setOpen(false)`
- On cancel: stay open

#### Step 4: Apply to key form dialogs (first batch)
Target the dialogs where users actually type significant data:

| Dialog | File | Why |
|--------|------|-----|
| NewProjectDialog | `src/components/production/NewProjectDialog.tsx` | Multi-field form |
| NewEntryDialog | `src/components/dashboard/NewEntryDialog.tsx` | Lead/opportunity entry |
| MagazineSalesEntryDialog | `src/components/dashboard/MagazineSalesEntryDialog.tsx` | Sales data entry |
| SubcontractorsManagement dialog | `src/components/production/SubcontractorsManagement.tsx` | Add/edit subcontractor |
| SalespeopleManagement dialog | `src/components/admin/SalespeopleManagement.tsx` | Add/edit salesperson |
| InvoiceConfirmDialog | `src/components/production/InvoiceConfirmDialog.tsx` | Custom amount entry |
| SchedulePaymentDialog | `src/components/production/analytics/SchedulePaymentDialog.tsx` | Payment scheduling |
| VersionBumpDialog | `src/components/layout/VersionBumpDialog.tsx` | Release notes |
| EstimateBuilderDialog | `src/components/estimates/EstimateBuilderDialog.tsx` | Already has its own persistence — integrate with new hooks |

Each refactored dialog will:
- Replace local `useState(false)` with `useModalQueryState("dialog-key")`
- Replace local form state with `usePersistentDraft("dialog-key", recordId)`
- Wire `onOpenChange` through `useDiscardConfirm` when dirty
- Clear draft on successful submit

#### Step 5: Skip these (no value in persisting)
- Delete/void confirmation AlertDialogs (no typed data)
- Image lightboxes and preview-only dialogs
- Read-only detail views

### Technical Details

**URL param approach** (replaceState, not pushState):
```text
Current URL: /project/abc?tab=finance
Open dialog: /project/abc?tab=finance&modal=new-project
Close dialog: /project/abc?tab=finance
```

**Draft key examples**:
```text
draft:new-project:new
draft:edit-subcontractor:sub-123
draft:schedule-payment:inv-456
```

**Hook usage pattern in a dialog component**:
```text
const { open, setOpen } = useModalQueryState("new-project");
const { draft, updateDraft, clearDraft, isDirty } = usePersistentDraft("new-project", recordId);

// Form fields read from `draft`, write via `updateDraft`
// On submit success: clearDraft() + setOpen(false)
// On close attempt: if isDirty, show discard confirm
```

### What NOT to change
- The existing `dialog.tsx` focus/blur protections — they work and should stay
- AlertDialog delete confirmations — no draft data to lose
- Preview/lightbox dialogs — no form inputs
- The existing `usePersistedDialog.ts` — will be replaced by the new hooks

### Estimated scope
- 3 new hook files
- ~9 dialog components refactored in the first batch
- Remaining dialogs can be migrated incrementally as needed

