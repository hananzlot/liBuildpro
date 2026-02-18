
## Duplicate Contact Detection Before Creating a New Opportunity

### Overview

When the user clicks "New Entry" and fills in a phone number or email, the app will query the `contacts` table for any existing contacts with a matching phone or email (scoped to the company). If duplicates are found, a warning panel will appear inside the dialog listing them — the user can then choose to proceed anyway or cancel.

### How It Will Work (User Flow)

1. User opens the New Entry dialog and types a phone number or email.
2. After leaving the phone/email field (on blur), the app quietly queries the database for matching contacts in the background.
3. If a match is found, a yellow warning banner appears below the phone/email fields listing the duplicate contacts (name, phone, email, source).
4. Two clear action buttons appear: **"Proceed Anyway"** (continues to submit as normal) and **"Cancel"** (closes the warning so the user can reconsider).
5. The submit button remains active — the warning is advisory, not a hard block. The user can still create the entry if it's intentional (e.g. same household, different opportunity).

### Technical Details

**New state variables** added to `NewEntryDialog.tsx`:
```
duplicateContacts: Contact[]  — list of matching contacts found
isDuplicateCheckPending: boolean  — shows a subtle spinner while checking
duplicateWarningDismissed: boolean  — tracks if user already acknowledged and chose to proceed
```

**Duplicate check logic** — a new async function `checkForDuplicates()`:
- Triggered `onBlur` on both the Phone and Email fields (not on every keystroke, to avoid excessive queries).
- Only runs if the field has a valid, non-empty value and passes format validation.
- Queries `contacts` table:
  ```sql
  SELECT id, contact_name, first_name, last_name, phone, email, source
  FROM contacts
  WHERE company_id = :companyId
    AND (
      (phone IS NOT NULL AND phone = :phone)
      OR (email IS NOT NULL AND LOWER(email) = LOWER(:email))
    )
  LIMIT 5
  ```
- Resets `duplicateWarningDismissed` to `false` whenever phone or email changes, so the warning reappears if the user edits those fields after dismissing.

**Warning UI** — inserted between the phone/email row and the address field:
- A styled amber/yellow alert box using the existing `Alert` component from `src/components/ui/alert.tsx`.
- Lists each matching contact as a row: name + phone + email + source badge.
- Two buttons: **Dismiss** (sets `duplicateWarningDismissed = true` and hides the banner) and the banner fades away.
- The submit button also shows a secondary note if duplicates exist but haven't been dismissed: "Duplicate found — review above before submitting."

**Submit guard** — `handleSubmitSingle()`:
- If `duplicateContacts.length > 0` and `!duplicateWarningDismissed`, the form will NOT submit immediately.
- Instead, it will scroll the warning into view and show a toast: "Potential duplicate found — please review before proceeding."
- Once the user clicks "Proceed Anyway" (sets `duplicateWarningDismissed = true`), the submit will go through on the next click.

**Reset behavior:**
- `resetForm()` also clears `duplicateContacts` and `duplicateWarningDismissed`.
- Changing phone or email after a check clears `duplicateWarningDismissed` and re-runs the check on blur.

### Files to Edit

- **`src/components/dashboard/NewEntryDialog.tsx`** — the only file that needs changes:
  - Add 3 new state variables.
  - Add `checkForDuplicates()` async function.
  - Add `onBlur` handlers to Phone and Email inputs.
  - Add duplicate warning UI block between the phone/email row and address field.
  - Update `handleSubmitSingle()` to guard against unreviewed duplicates.
  - Update `resetForm()` to clear duplicate state.

### No Database Changes

No migrations or schema changes needed. The duplicate check is a read-only query against the existing `contacts` table using existing columns (`phone`, `email`, `company_id`).
