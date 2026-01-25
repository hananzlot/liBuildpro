-- Allow super admins to update any profile (including those without company_id)
CREATE POLICY "Super admins can update any profile"
ON public.profiles
FOR UPDATE
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));