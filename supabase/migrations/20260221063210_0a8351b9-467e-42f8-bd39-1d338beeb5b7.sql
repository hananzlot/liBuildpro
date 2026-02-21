-- Delete the duplicate project created by the edge function (no created_by, has UUID as salesperson)
DELETE FROM projects WHERE id = '9d040d2d-784b-4112-9858-81afe909f7c5';

-- Set the correct salesperson name on the remaining project (currently NULL)
UPDATE projects 
SET primary_salesperson = 'EZ'
WHERE id = '9bf82da9-d6e0-4bfc-9b4e-997332dd9364'
  AND primary_salesperson IS NULL;