
-- Allow admins (including corp_admin) to manage roles for users in their company
CREATE POLICY "Admins can manage roles in their company"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id IS NOT NULL
    AND public.has_company_access(p.company_id)
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id IS NOT NULL
    AND public.has_company_access(p.company_id)
  )
  -- Prevent non-super-admins from granting super_admin role
  AND (role != 'super_admin' OR public.is_super_admin(auth.uid()))
);
