-- Fix the one opportunity with incorrect pipeline name
UPDATE opportunities 
SET pipeline_name = 'Main'
WHERE id = 'e031248d-8ea5-43c7-a9a3-c2d00d04e9bf' 
  AND pipeline_name = 'Main Pipeline';