-- Backfill created_at with ghl_date_added for accuracy on legacy records
UPDATE opportunities SET created_at = ghl_date_added WHERE ghl_date_added IS NOT NULL;
UPDATE contacts SET created_at = ghl_date_added WHERE ghl_date_added IS NOT NULL;
UPDATE appointments SET created_at = ghl_date_added WHERE ghl_date_added IS NOT NULL;