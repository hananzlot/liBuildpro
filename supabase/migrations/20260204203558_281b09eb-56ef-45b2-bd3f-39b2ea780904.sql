-- Add opportunity_number column
ALTER TABLE public.opportunities 
ADD COLUMN opportunity_number INTEGER;

-- Update existing records to have sequential numbers based on creation date within each company
WITH numbered AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY COALESCE(ghl_date_added, created_at) ASC) as new_num
  FROM public.opportunities
)
UPDATE public.opportunities o
SET opportunity_number = n.new_num
FROM numbered n
WHERE o.id = n.id;

-- Create a sequence for auto-incrementing new opportunities
CREATE SEQUENCE IF NOT EXISTS opportunity_number_seq;

-- Set the sequence to start after the max opportunity_number
SELECT setval('opportunity_number_seq', COALESCE((SELECT MAX(opportunity_number) FROM opportunities), 0));

-- Create a function to auto-assign opportunity_number on insert
CREATE OR REPLACE FUNCTION public.auto_assign_opportunity_number()
RETURNS TRIGGER AS $$
DECLARE
  v_max_num INTEGER;
BEGIN
  IF NEW.opportunity_number IS NULL THEN
    -- Get the max number for this company and add 1
    SELECT COALESCE(MAX(opportunity_number), 0) + 1 INTO v_max_num
    FROM public.opportunities
    WHERE company_id = NEW.company_id;
    
    NEW.opportunity_number := v_max_num;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS set_opportunity_number ON public.opportunities;
CREATE TRIGGER set_opportunity_number
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_opportunity_number();