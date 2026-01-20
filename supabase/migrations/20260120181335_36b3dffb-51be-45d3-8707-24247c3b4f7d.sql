-- Simplified trigger: Always assign user's company_id to new records
CREATE OR REPLACE FUNCTION public.set_company_id_from_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_company_id uuid;
BEGIN
  -- Only set company_id if it's NULL and user is authenticated
  IF NEW.company_id IS NULL AND auth.uid() IS NOT NULL THEN
    -- Get user's company_id from their profile
    SELECT company_id INTO user_company_id
    FROM public.profiles
    WHERE id = auth.uid();
    
    -- Assign user's company to the record
    NEW.company_id := user_company_id;
  END IF;
  
  RETURN NEW;
END;
$$;