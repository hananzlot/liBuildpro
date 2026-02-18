
## Fix: Annabella Cannot Add Scope, Appointments, or Tasks

### Root Cause Summary

Three separate bugs affect non-admin users like Annabella (roles: dispatch, production, sales, contract_manager):

---

### Bug 1: Scope of Work silently fails for locally-created opportunities

**File:** `src/components/dashboard/OpportunityDetailSheet.tsx` — `handleSaveScope()` at line 2072

```typescript
const handleSaveScope = async () => {
  if (!opportunity?.ghl_id) return;  // ← SILENT RETURN if ghl_id is null
```

Locally created opportunities (via "Create Opp" button) have `ghl_id: null`. The save button appears and clicks, but nothing happens. The fix is to fall back to `opportunity?.id` (the UUID) when `ghl_id` is null, and pass both to the edge function. The `update-opportunity-scope` edge function should then query by UUID when the ghl_id is a local ID or null.

**Fix approach:**
- In `handleSaveScope`, use `opportunity.id` as fallback identifier when `ghl_id` is null
- Pass `opportunityId` (UUID) alongside `opportunityGhlId` to the edge function
- In `update-opportunity-scope/index.ts`, if `opportunityGhlId` is null or missing, use `opportunityId` to look up and update the record by UUID

---

### Bug 2: Task creation fails silently for locally-created opportunities

**File:** `src/components/dashboard/OpportunityDetailSheet.tsx` — `handleCreateTask()` at line 880

```typescript
contactId: opportunity.contact_id,  // ← passes "local_contact_..." string
```

The `create-ghl-task` edge function tries to look up the contact using `ghl_id = 'local_contact_...'` to resolve `company_id`, but finds nothing since local contacts use their UUID as `id`, not `ghl_id`. The insert proceeds without a `company_id`, which means Annabella's company RLS filter won't show it.

**Fix approach:**
- Pass `companyId` explicitly in the task creation body (already available via `useCompanyContext`)
- Also pass `contactUuid: opportunity.contact_uuid` alongside `contactId` in the body
- In the edge function, prefer UUID-based lookup when resolving company context

---

### Bug 3: Appointment creation missing companyId

**File:** `src/components/dashboard/OpportunityDetailSheet.tsx` — `handleCreateAppointment()` at line 1211

The `create-ghl-appointment` edge function is called without `companyId` in the body. Same issue as tasks — when it tries to auto-resolve the company from `contacts.ghl_id = 'local_contact_...'`, it gets nothing, and the appointment record is created with `company_id = null`. Annabella then can't see it due to RLS.

**Fix approach:**
- Pass `companyId` explicitly in the appointment creation body

---

### What is NOT broken

- Notes work because `create-contact-note` resolves by `contact_id` differently and the `contact_notes` table has an open INSERT policy for all company users
- The UI buttons all show for Annabella — no role guards block the buttons
- Annabella's roles are correctly set — this is purely a data/logic bug

---

### Technical Details

**Files to edit:**
1. `src/components/dashboard/OpportunityDetailSheet.tsx`
   - `handleSaveScope`: add fallback to `opportunity.id` when `opportunity.ghl_id` is null
   - `handleCreateTask`: add `companyId` and `contactUuid` to the invocation body
   - `handleCreateAppointment`: add `companyId` to the invocation body

2. `supabase/functions/update-opportunity-scope/index.ts`
   - Accept `opportunityId` (UUID) as a fallback when `opportunityGhlId` is null
   - Query by `id` (UUID) when `opportunityGhlId` is null or a local ID

3. `supabase/functions/create-ghl-task/index.ts`
   - Accept and use `companyId` directly from the request body when provided (skip the lookup)
   - Accept `contactUuid` and use it for UUID-based contact lookup when `contactId` is a local ID

4. `supabase/functions/create-ghl-appointment/index.ts`
   - Accept and use `companyId` directly from the request body when provided

---

### No Database / Migration Changes Required

All fixes are in frontend component logic and edge function logic only.
