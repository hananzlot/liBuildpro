
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Super admins can insert project_statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Super admins can update project_statuses" ON public.project_statuses;
DROP POLICY IF EXISTS "Super admins can delete project_statuses" ON public.project_statuses;

-- Create new policies that allow all admin roles
CREATE POLICY "Admins can insert project_statuses"
ON public.project_statuses FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()) AND has_company_access(company_id));

CREATE POLICY "Admins can update project_statuses"
ON public.project_statuses FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()) AND has_company_access(company_id));

CREATE POLICY "Admins can delete project_statuses"
ON public.project_statuses FOR DELETE
TO authenticated
USING (is_admin(auth.uid()) AND has_company_access(company_id));
