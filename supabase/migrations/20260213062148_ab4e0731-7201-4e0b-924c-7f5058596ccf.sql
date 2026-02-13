-- Drop and recreate the "Admins manage projects" policy to include corp_admin
DROP POLICY IF EXISTS "Admins manage projects in their company" ON public.projects;

CREATE POLICY "Admins manage projects in their company" 
ON public.projects 
FOR ALL 
USING (has_company_access(company_id) AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'corp_admin'::app_role)))
WITH CHECK (has_company_access(company_id) AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'corp_admin'::app_role)));

-- Also update "Production or admin manage company projects" to include corp_admin
DROP POLICY IF EXISTS "Production or admin manage company projects" ON public.projects;

CREATE POLICY "Production or admin manage company projects" 
ON public.projects 
FOR ALL 
USING (has_company_access(company_id) AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'production'::app_role) OR has_role(auth.uid(), 'corp_admin'::app_role)))
WITH CHECK (has_company_access(company_id) AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'production'::app_role) OR has_role(auth.uid(), 'corp_admin'::app_role)));