-- Change trade column from text to text array for multi-selection
ALTER TABLE public.subcontractors 
ALTER COLUMN trade TYPE text[] 
USING CASE 
  WHEN trade IS NOT NULL THEN ARRAY[trade]
  ELSE NULL
END;