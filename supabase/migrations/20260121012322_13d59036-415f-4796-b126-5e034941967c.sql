-- Update Raya Gamburd's opportunity with the scope from her Facebook campaign
UPDATE opportunities
SET scope_of_work = 'Deck & Patio Cover'
WHERE name = 'Raya Gamburd' 
  AND location_id = 'XYDIgpHivVWHii65sId5'
  AND scope_of_work IS NULL;