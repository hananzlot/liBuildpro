-- Update has_company_access to allow super admins to access any company
CREATE OR REPLACE FUNCTION public.has_company_access(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Super admins can access any company
    public.is_super_admin(auth.uid())
    OR
    -- Direct company access
    target_company_id = public.get_user_company_id()
    OR
    -- Corp admin can access all companies in their corporation
    (
      public.is_corp_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.companies c1
        JOIN public.companies c2 ON c1.corporation_id = c2.corporation_id
        WHERE c1.id = target_company_id
        AND c2.id = public.get_user_company_id()
      )
    )
$$;