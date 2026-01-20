-- Fix RLS policies for projects table to properly scope by company_id
-- Drop the policies that don't check company_id
DROP POLICY IF EXISTS "Production or admin can read projects" ON public.projects;
DROP POLICY IF EXISTS "Production or admin can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Production or admin can update projects" ON public.projects;
DROP POLICY IF EXISTS "Production or admin can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Users manage projects in their company" ON public.projects;
DROP POLICY IF EXISTS "Users view projects in their company" ON public.projects;
DROP POLICY IF EXISTS "Service role projects" ON public.projects;

-- Create proper company-scoped policies
-- Super admins can access all projects
CREATE POLICY "Super admins full access to projects"
ON public.projects FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Users with production or admin role can manage projects in their company
CREATE POLICY "Production or admin manage company projects"
ON public.projects FOR ALL
USING (
  public.has_company_access(company_id) 
  AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'))
)
WITH CHECK (
  public.has_company_access(company_id) 
  AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'))
);

-- Fix RLS for opportunities table
DROP POLICY IF EXISTS "Allow public read access" ON public.opportunities;
DROP POLICY IF EXISTS "Allow service role full access" ON public.opportunities;
DROP POLICY IF EXISTS "Users manage opportunities in their company" ON public.opportunities;
DROP POLICY IF EXISTS "Users view opportunities in their company" ON public.opportunities;

CREATE POLICY "Super admins full access to opportunities"
ON public.opportunities FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view opportunities in their company"
ON public.opportunities FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Users manage opportunities in their company"
ON public.opportunities FOR ALL
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- Fix RLS for contacts table
DROP POLICY IF EXISTS "Allow public read access" ON public.contacts;
DROP POLICY IF EXISTS "Allow service role full access" ON public.contacts;
DROP POLICY IF EXISTS "Users manage contacts in their company" ON public.contacts;
DROP POLICY IF EXISTS "Users view contacts in their company" ON public.contacts;

CREATE POLICY "Super admins full access to contacts"
ON public.contacts FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view contacts in their company"
ON public.contacts FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Users manage contacts in their company"
ON public.contacts FOR ALL
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- Fix RLS for appointments table
DROP POLICY IF EXISTS "Allow public read access" ON public.appointments;
DROP POLICY IF EXISTS "Allow service role full access" ON public.appointments;
DROP POLICY IF EXISTS "Users manage appointments in their company" ON public.appointments;
DROP POLICY IF EXISTS "Users view appointments in their company" ON public.appointments;

CREATE POLICY "Super admins full access to appointments"
ON public.appointments FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view appointments in their company"
ON public.appointments FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Users manage appointments in their company"
ON public.appointments FOR ALL
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- Fix RLS for estimates table - add company_id check
DROP POLICY IF EXISTS "Admin can delete estimates" ON public.estimates;
DROP POLICY IF EXISTS "Admin or contract_manager can insert estimates" ON public.estimates;
DROP POLICY IF EXISTS "Admin or contract_manager can read estimates" ON public.estimates;
DROP POLICY IF EXISTS "Admin or contract_manager can update estimates" ON public.estimates;

CREATE POLICY "Super admins full access to estimates"
ON public.estimates FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin or contract_manager manage company estimates"
ON public.estimates FOR ALL
USING (
  public.has_company_access(company_id) 
  AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'contract_manager'))
)
WITH CHECK (
  public.has_company_access(company_id) 
  AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'contract_manager'))
);