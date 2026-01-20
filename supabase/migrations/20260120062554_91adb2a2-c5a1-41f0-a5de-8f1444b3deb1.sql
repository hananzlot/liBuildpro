-- Fix profiles table RLS - remove overly permissive policy
DROP POLICY IF EXISTS "Users can read all profiles" ON public.profiles;

-- The "Users view profiles in their company" policy already exists and is correct
-- But let's also ensure the get_user_company_id function can access the user's own profile
-- by creating a specific policy for that

-- Also need to check user_roles table since has_role function needs it
-- Let's ensure user_roles is accessible

-- Check and fix user_roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins full access to user_roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admins full access to user_roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage roles in their company"
ON public.user_roles FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = user_roles.user_id 
    AND public.has_company_access(p.company_id)
  )
)
WITH CHECK (
  public.is_admin(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = user_roles.user_id 
    AND public.has_company_access(p.company_id)
  )
);