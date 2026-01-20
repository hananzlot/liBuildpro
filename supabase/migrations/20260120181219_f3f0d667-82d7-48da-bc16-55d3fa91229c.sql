-- Update trigger to skip auto-assignment for super_admins
-- This allows super_admins to explicitly control company_id (including NULL for platform-level records)
CREATE OR REPLACE FUNCTION public.set_company_id_from_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_company_id uuid;
  is_super boolean;
BEGIN
  -- Only set company_id if it's NULL and user is authenticated
  IF NEW.company_id IS NULL AND auth.uid() IS NOT NULL THEN
    -- Check if user is super_admin - they can explicitly control company_id
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    ) INTO is_super;
    
    -- Super admins don't get auto-assignment (they control it explicitly)
    IF is_super THEN
      RETURN NEW;
    END IF;
    
    -- Regular users get their company_id auto-assigned
    SELECT company_id INTO user_company_id
    FROM public.profiles
    WHERE id = auth.uid();
    
    NEW.company_id := user_company_id;
  END IF;
  
  RETURN NEW;
END;
$$;