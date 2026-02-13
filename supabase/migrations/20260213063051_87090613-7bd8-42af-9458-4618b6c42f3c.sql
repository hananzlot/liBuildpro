
-- Update is_admin() to include corp_admin role
-- This single change fixes ALL RLS policies that use is_admin() across the entire database
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'corp_admin')
  )
$function$;

-- Remove the now-redundant corp_admin checks we added to projects earlier,
-- since is_admin() now covers corp_admin
DROP POLICY IF EXISTS "Admins manage projects in their company" ON public.projects;
CREATE POLICY "Admins manage projects in their company" 
ON public.projects FOR ALL 
USING (has_company_access(company_id) AND is_admin(auth.uid()))
WITH CHECK (has_company_access(company_id) AND is_admin(auth.uid()));

DROP POLICY IF EXISTS "Production or admin manage company projects" ON public.projects;
CREATE POLICY "Production or admin manage company projects" 
ON public.projects FOR ALL 
USING (has_company_access(company_id) AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'production'::app_role)))
WITH CHECK (has_company_access(company_id) AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'production'::app_role)));
