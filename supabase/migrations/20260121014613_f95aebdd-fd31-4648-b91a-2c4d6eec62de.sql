-- Phase 1: Merge Contact Attributions from Location 2 → Location 1
UPDATE contacts c1
SET attributions = c2.attributions
FROM contacts c2
WHERE c1.location_id = 'pVeFrqvtYWNIPRIi0Fmr'
  AND c2.location_id = 'XYDIgpHivVWHii65sId5'
  AND LOWER(c1.contact_name) = LOWER(c2.contact_name)
  AND (c1.attributions IS NULL OR c1.attributions::text = 'null' OR c1.attributions::text = '[]')
  AND c2.attributions IS NOT NULL 
  AND c2.attributions::text != 'null' 
  AND c2.attributions::text != '[]';

-- Phase 2: Merge Opportunity scope_of_work from Location 2 → Location 1
UPDATE opportunities o1
SET scope_of_work = o2.scope_of_work
FROM opportunities o2
WHERE o1.location_id = 'pVeFrqvtYWNIPRIi0Fmr'
  AND o2.location_id = 'XYDIgpHivVWHii65sId5'
  AND LOWER(o1.name) = LOWER(o2.name)
  AND o1.scope_of_work IS NULL
  AND o2.scope_of_work IS NOT NULL;

-- Phase 3a: Delete duplicate opportunities from Location 2
DELETE FROM opportunities
WHERE location_id = 'XYDIgpHivVWHii65sId5'
  AND LOWER(name) IN (
    SELECT LOWER(name) FROM opportunities 
    WHERE location_id = 'pVeFrqvtYWNIPRIi0Fmr'
  );

-- Phase 3b: Delete duplicate contacts from Location 2
DELETE FROM contacts
WHERE location_id = 'XYDIgpHivVWHii65sId5'
  AND LOWER(contact_name) IN (
    SELECT LOWER(contact_name) FROM contacts 
    WHERE location_id = 'pVeFrqvtYWNIPRIi0Fmr'
  );