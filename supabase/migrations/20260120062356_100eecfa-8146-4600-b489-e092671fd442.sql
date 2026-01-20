-- Fix RLS policies to include proper role targeting (TO authenticated)
-- The policies exist but may not be targeting the right roles

-- Drop and recreate core table policies with proper TO clause

-- CONTACTS
DROP POLICY IF EXISTS "Super admins full access to contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users view contacts in their company" ON public.contacts;
DROP POLICY IF EXISTS "Users manage contacts in their company" ON public.contacts;

CREATE POLICY "Super admins full access to contacts"
ON public.contacts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view contacts in their company"
ON public.contacts FOR SELECT
TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "Admins manage contacts in their company"
ON public.contacts FOR ALL
TO authenticated
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- OPPORTUNITIES
DROP POLICY IF EXISTS "Super admins full access to opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users view opportunities in their company" ON public.opportunities;
DROP POLICY IF EXISTS "Users manage opportunities in their company" ON public.opportunities;

CREATE POLICY "Super admins full access to opportunities"
ON public.opportunities FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view opportunities in their company"
ON public.opportunities FOR SELECT
TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "Admins manage opportunities in their company"
ON public.opportunities FOR ALL
TO authenticated
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- APPOINTMENTS
DROP POLICY IF EXISTS "Super admins full access to appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users view appointments in their company" ON public.appointments;
DROP POLICY IF EXISTS "Users manage appointments in their company" ON public.appointments;

CREATE POLICY "Super admins full access to appointments"
ON public.appointments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view appointments in their company"
ON public.appointments FOR SELECT
TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "Admins manage appointments in their company"
ON public.appointments FOR ALL
TO authenticated
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- PROJECTS
DROP POLICY IF EXISTS "Super admins full access to projects" ON public.projects;
DROP POLICY IF EXISTS "Users view projects in their company" ON public.projects;
DROP POLICY IF EXISTS "Users manage projects in their company" ON public.projects;

CREATE POLICY "Super admins full access to projects"
ON public.projects FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view projects in their company"
ON public.projects FOR SELECT
TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "Admins manage projects in their company"
ON public.projects FOR ALL
TO authenticated
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- ESTIMATES
DROP POLICY IF EXISTS "Super admins full access to estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users view estimates in their company" ON public.estimates;
DROP POLICY IF EXISTS "Users manage estimates in their company" ON public.estimates;

CREATE POLICY "Super admins full access to estimates"
ON public.estimates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view estimates in their company"
ON public.estimates FOR SELECT
TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "Admins manage estimates in their company"
ON public.estimates FOR ALL
TO authenticated
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- GHL_TASKS (for follow-up)
DROP POLICY IF EXISTS "Super admins full access to ghl_tasks" ON public.ghl_tasks;
DROP POLICY IF EXISTS "Users view ghl_tasks in their company" ON public.ghl_tasks;
DROP POLICY IF EXISTS "Admins manage ghl_tasks in their company" ON public.ghl_tasks;

CREATE POLICY "Super admins full access to ghl_tasks"
ON public.ghl_tasks FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view ghl_tasks in their company"
ON public.ghl_tasks FOR SELECT
TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "Admins manage ghl_tasks in their company"
ON public.ghl_tasks FOR ALL
TO authenticated
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));