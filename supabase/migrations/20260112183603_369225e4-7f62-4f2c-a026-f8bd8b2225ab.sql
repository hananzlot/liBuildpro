-- Backfill the project with data from the opportunity
UPDATE public.projects 
SET 
  project_scope_dispatch = 'Sold',
  sold_dispatch_value = 150000
WHERE id = '15c5ea2f-0bfc-4be5-99f9-b9749587b681';