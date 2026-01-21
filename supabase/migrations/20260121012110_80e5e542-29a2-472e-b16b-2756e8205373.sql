-- Backfill scope_of_work from contact attributions utmContent for Location 2 opportunities
-- This is needed because the initial sync didn't extract scope from attributions

UPDATE opportunities o
SET scope_of_work = (
  SELECT (c.attributions->0->>'utmContent')
  FROM contacts c 
  WHERE c.ghl_id = o.contact_id
    AND c.attributions IS NOT NULL
    AND jsonb_array_length(c.attributions) > 0
    AND c.attributions->0->>'utmContent' IS NOT NULL
  LIMIT 1
)
WHERE o.scope_of_work IS NULL
  AND o.location_id = 'XYDIgpHivVWHii65sId5'
  AND EXISTS (
    SELECT 1 FROM contacts c 
    WHERE c.ghl_id = o.contact_id
      AND c.attributions IS NOT NULL
      AND jsonb_array_length(c.attributions) > 0
      AND c.attributions->0->>'utmContent' IS NOT NULL
  );