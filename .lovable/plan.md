
# Plan: Email Format Validation When Updating Contact Email

## What's Changing and Why

When a user edits the contact email in the Appointment Detail Sheet and clicks Save, there is currently **no validation** that the typed value is a properly formatted email address. If someone types a partial or malformed email, it gets sent straight to the edge function and stored in the DB.

The fix adds two layers of protection:

1. **Save-time guard** — before `setIsSavingContact(true)`, check the email string against a standard regex and bail out early with a toast error if it fails.
2. **Inline field error** — while the user is typing, show a small red error message beneath the email input so they get instant feedback without needing to hit Save.

---

## Technical Details

### File: `src/components/dashboard/AppointmentDetailSheet.tsx`

#### Part A — Validation state variable

Add one new state variable near the other `editContact*` state declarations (~line 268):

```typescript
const [emailValidationError, setEmailValidationError] = useState<string | null>(null);
```

#### Part B — onChange handler for email input

At the email `<Input>` component (~line 1283), replace the plain `onChange` with one that clears the error when the field is empty or the format is valid, and sets it otherwise:

```tsx
onChange={(e) => {
  const val = e.target.value;
  setEditContactEmail(val);
  // Validate only when there's a non-empty value
  if (val.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
    setEmailValidationError("Please enter a valid email address");
  } else {
    setEmailValidationError(null);
  }
}}
```

Add a small error line directly below the `<Input>`:

```tsx
{emailValidationError && (
  <p className="text-xs text-destructive mt-0.5">{emailValidationError}</p>
)}
```

#### Part C — Guard in `handleSaveContact` (~line 1055)

Add the validation check right after the existing "missing ID" guard, before `setIsSavingContact(true)`:

```typescript
// Validate email format before saving
const trimmedEmail = editContactEmail.trim();
if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
  toast.error("Please enter a valid email address");
  return;
}
```

Also clear the validation error when the user cancels editing (in `cancelEditingContact`):

```typescript
setEmailValidationError(null);
```

---

## Files Changed

| File | Change |
|---|---|
| `src/components/dashboard/AppointmentDetailSheet.tsx` | Add `emailValidationError` state, inline error under email input, save-time guard, clear on cancel |

---

## Behaviour After the Fix

| Scenario | Result |
|---|---|
| User types `john.doe@example.com` | No error shown; saves normally |
| User types `notanemail` | Red error appears under field while typing; Save blocked with toast |
| User types `test@` | Red error appears; Save blocked |
| User clears the email field entirely | No error (empty email is allowed — contact may not have one) |
| User cancels editing | Error cleared |
