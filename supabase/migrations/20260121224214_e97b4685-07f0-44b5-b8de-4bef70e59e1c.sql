-- Drop and recreate the SELECT policy on profiles to include super_admin access
DROP POLICY IF EXISTS "Users view profiles in their company" ON public.profiles;

-- Create a helper function to check if user is a super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- Create new SELECT policy that:
-- 1. Users can always see their own profile
-- 2. Super admins can see ALL profiles
-- 3. Regular users can see profiles in their company (where company_id is not null)
CREATE POLICY "Users view profiles in their company or super_admin sees all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (id = auth.uid())
  OR public.is_super_admin(auth.uid())
  OR ((company_id IS NOT NULL) AND has_company_access(company_id))
);