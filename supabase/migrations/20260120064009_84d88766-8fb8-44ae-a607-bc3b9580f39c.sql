-- Fix subcontractors RLS: remove cross-tenant policies and enforce company isolation

-- Drop all conflicting policies
DROP POLICY IF EXISTS "Production or admin can read subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Production or admin can insert subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Production or admin can update subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Production or admin can delete subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Production or admin manage subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Admins manage subcontractors in their company" ON public.subcontractors;
DROP POLICY IF EXISTS "Users view subcontractors in their company" ON public.subcontractors;
DROP POLICY IF EXISTS "Super admins full access to subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Service role subcontractors" ON public.subcontractors;

-- Recreate with proper company scoping
CREATE POLICY "Super admins full access to subcontractors"
ON public.subcontractors FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view subcontractors in their company"
ON public.subcontractors FOR SELECT
TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "Production or admin can manage subcontractors in company"
ON public.subcontractors FOR ALL
TO authenticated
USING (
  public.has_company_access(company_id) 
  AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'))
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.has_company_access(company_id) 
  AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'))
);