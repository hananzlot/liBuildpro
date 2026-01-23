-- Update all GHL Location 2 opportunities from yesterday to show today's created date
UPDATE opportunities 
SET ghl_date_added = NOW()
WHERE location_id = 'XYDIgpHivVWHii65sId5' 
AND ghl_date_added::date = (CURRENT_DATE - INTERVAL '1 day')::date;