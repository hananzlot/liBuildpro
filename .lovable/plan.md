

## Plan: Backfill `created_at` from `ghl_date_added` + Use `created_at` as Primary Date

### Step 1: Data Backfill (SQL — run via data update tool)

Update `created_at` on all three tables (opportunities, contacts, appointments) to match `ghl_date_added` where `ghl_date_added` is not null. This ensures legacy records have accurate `created_at` values reflecting the original creation date rather than the sync import date.

```sql
-- Opportunities
UPDATE opportunities SET created_at = ghl_date_added WHERE ghl_date_added IS NOT NULL;

-- Contacts  
UPDATE contacts SET created_at = ghl_date_added WHERE ghl_date_added IS NOT NULL;

-- Appointments
UPDATE appointments SET created_at = ghl_date_added WHERE ghl_date_added IS NOT NULL;
```

### Step 2: Code Changes

**File: `src/hooks/useGHLContacts.ts`**

1. **Add `created_at` to `DBOpportunity` interface** (~line 30-51): Add `created_at?: string | null` field (it's missing, unlike DBContact and DBAppointment which already have it).

2. **Update `filterByDateRange` helper** (~line 502-519): Change the generic constraint and default logic to use `created_at` with fallback to `ghl_date_added`:
   ```typescript
   function filterByDateRange<T extends { created_at?: string | null; ghl_date_added?: string | null }>(
     items: T[],
     dateRange?: DateRange,
   ): T[] {
     if (!dateRange?.from) return items;
     const startDate = dateRange.from;
     const endDate = dateRange.to || new Date();
     endDate.setHours(23, 59, 59, 999);
     return items.filter((item) => {
       const dateValue = item.created_at || item.ghl_date_added;
       if (!dateValue) return false;
       const date = new Date(dateValue as string);
       return date >= startDate && date <= endDate;
     });
   }
   ```

3. **Update opportunity date filtering** (~line 564-574): Use `created_at || ghl_date_added`:
   ```typescript
   const oppDate = opp.created_at || opp.ghl_date_added;
   ```

4. **Update contact date map** (~line 559-561): Use `created_at` with fallback:
   ```typescript
   contactDateMap.set(c.ghl_id, c.created_at || c.ghl_date_added || null);
   ```

**File: `src/components/dashboard/SalesRepDetailSheet.tsx`**

5. **Add `created_at` to Opportunity interface** (~line 22-37): Add `created_at?: string | null`.

6. **Add `created_at` to Appointment interface** (~line 39-51): Add `created_at?: string | null`.

7. **Update opportunity date filter** (~line 157): Change from `isInDateRange(o.ghl_date_added)` to `isInDateRange(o.created_at || o.ghl_date_added)`.

8. **Update appointment date filter** (~line 166): Change from `isInDateRange(a.start_time)` to `isInDateRange(a.created_at || a.start_time)`.

### Summary

After the backfill, `created_at` will equal `ghl_date_added` for all existing records. Going forward, new records will get `created_at` set at insert time (by DB default), and `ghl_date_added` from GHL sync. The code will always prefer `created_at`, falling back to `ghl_date_added` only when `created_at` is null.

