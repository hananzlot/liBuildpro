

## Why Demo Co #1's KPI Shows No Records

**Root Cause**: All 1,176 opportunities for Demo Co #1 have `contact_uuid` (the internal UUID) but **zero** have `contact_id` (the GHL ID). The source chart and opportunity-by-source logic in `processMetrics` maps opportunities to contacts using `o.contact_id` matched against `c.ghl_id`. Since `contact_id` is null for all Demo Co #1 opportunities, every opportunity fails the `if (o.contact_id)` check and is skipped entirely.

CA Pro Builders works because its opportunities were synced from GHL and have `contact_id` populated.

---

## Plan: Fix Source Attribution to Use Both `contact_id` and `contact_uuid`

### File: `src/hooks/useGHLContacts.ts`

**Change 1: Expand `contactSourceMap` to include UUID-based lookups** (~line 933-936)

Currently:
```typescript
const contactSourceMap = new Map<string, string>();
contacts.forEach((c) => {
  contactSourceMap.set(c.ghl_id, normalizeSourceName(c.source || "Direct"));
});
```

Update to also map by contact UUID (`c.id`):
```typescript
const contactSourceMap = new Map<string, string>();
contacts.forEach((c) => {
  const normalized = normalizeSourceName(c.source || "Direct");
  contactSourceMap.set(c.ghl_id, normalized);
  contactSourceMap.set(c.id, normalized);  // Also map by UUID
});
```

**Change 2: Update all opportunity source lookups to fall back to `contact_uuid`**

There are ~6 places in `processMetrics` where opportunities are grouped by source using `o.contact_id`. Each needs a fallback to `o.contact_uuid`:

- **Won by source** (~line 940): `const source = contactSourceMap.get(o.contact_id) || ...`
- **Opportunities by source** (~line 960): same pattern
- **Appointments by source** lookups
- **Opps without appointments by source**

For each, change the pattern from:
```typescript
if (o.contact_id) {
  const source = contactSourceMap.get(o.contact_id) || "Direct";
```
To:
```typescript
const contactKey = o.contact_id || o.contact_uuid;
if (contactKey) {
  const source = contactSourceMap.get(contactKey) || "Direct";
```

**Change 3: Update contact-based appointment lookups** similarly, so `contactAssignmentMap` and `appointmentAssignmentMap` also index by UUID.

### Technical Detail

This affects the following computed metrics:
- `opportunitiesBySource` (the "Opportunities by Source" chart)
- `wonBySource` (the "Won By Source" chart)
- `appointmentsBySource`
- `oppsWithoutAppointmentsBySource`
- `salesRepPerformance` (where effective assignment uses contact lookups)

No database changes needed. No migration required. This is purely a code-level fix to support contacts/opportunities that were created locally (without GHL sync) and therefore only have UUIDs.

