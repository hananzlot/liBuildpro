-- Allow admins to view user_roles for users in their company
CREATE POLICY "Admins can view roles in their company"
ON public.user_roles
FOR SELECT
USING (
  is_admin(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
    AND has_company_access(p.company_id)
  )
);