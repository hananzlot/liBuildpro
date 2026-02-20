

## Auto-Update "Last Edited" Date on Local Edits

### Problem
When you edit an opportunity locally (e.g., changing the sales rep, stage, or any field), the "Last Edited" date doesn't update because there's no database trigger to set `updated_at` on the `opportunities` table.

### Solution

**1. Add a database trigger** on the `opportunities` table that automatically sets `updated_at = now()` whenever any row is updated. The project already has a reusable `update_updated_at_column()` function defined -- we just need to attach it to the `opportunities` table.

**2. Update the UI** in `OpportunitiesTable.tsx` to use `updated_at` as the primary date for the "Last Edited" column, falling back to `ghl_date_updated` and then `ghl_date_added`.

### Technical Details

**Database migration:**
```sql
CREATE TRIGGER set_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

**UI change in `OpportunitiesTable.tsx`:**
- Change the date resolution order from `ghl_date_updated || ghl_date_added` to `updated_at || ghl_date_updated || ghl_date_added`
- This ensures local edits immediately reflect in the "Last Edited" column
- GHL syncs will also trigger the trigger, so the date stays current either way

