
-- Backfill existing estimates with sequential numbers per company (starting from 1001)
WITH numbered AS (
  SELECT id, company_id,
    ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at ASC) + 1000 AS num
  FROM public.estimates
  WHERE estimate_number IS NULL
)
UPDATE public.estimates e
SET estimate_number = n.num
FROM numbered n
WHERE e.id = n.id;

-- Create auto-assign function
CREATE OR REPLACE FUNCTION public.auto_assign_estimate_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_max_num INTEGER;
BEGIN
  IF NEW.estimate_number IS NULL THEN
    SELECT COALESCE(MAX(estimate_number), 1000) + 1 INTO v_max_num
    FROM public.estimates
    WHERE company_id = NEW.company_id;
    
    NEW.estimate_number := v_max_num;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS auto_assign_estimate_number_trigger ON public.estimates;
CREATE TRIGGER auto_assign_estimate_number_trigger
BEFORE INSERT ON public.estimates
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_estimate_number();
