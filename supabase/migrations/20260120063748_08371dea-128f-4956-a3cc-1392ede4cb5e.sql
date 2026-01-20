-- Fix magazine_sales RLS: remove cross-tenant "magazine role" policies and enforce company isolation

-- Ensure RLS is enabled
ALTER TABLE public.magazine_sales ENABLE ROW LEVEL SECURITY;

-- Drop overly-permissive / cross-tenant policies
DROP POLICY IF EXISTS "Magazine or admin can read magazine_sales" ON public.magazine_sales;
DROP POLICY IF EXISTS "Magazine or admin can insert magazine_sales" ON public.magazine_sales;
DROP POLICY IF EXISTS "Creator or admin can update magazine_sales" ON public.magazine_sales;
DROP POLICY IF EXISTS "Creator or admin can delete magazine_sales" ON public.magazine_sales;
DROP POLICY IF EXISTS "Users view magazine sales in their company" ON public.magazine_sales;
DROP POLICY IF EXISTS "Users manage magazine sales in their company" ON public.magazine_sales;

-- Recreate policies with company scoping
CREATE POLICY "Super admins full access to magazine_sales"
ON public.magazine_sales
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins or magazine can read magazine_sales in company"
ON public.magazine_sales
FOR SELECT
TO authenticated
USING (
  public.has_company_access(company_id)
  AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'magazine'))
);

CREATE POLICY "Admins or magazine can insert magazine_sales in company"
ON public.magazine_sales
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IS NOT NULL
  AND public.has_company_access(company_id)
  AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'magazine'))
);

CREATE POLICY "Creator or admin can update magazine_sales in company"
ON public.magazine_sales
FOR UPDATE
TO authenticated
USING (
  public.has_company_access(company_id)
  AND (public.is_admin(auth.uid()) OR entered_by = auth.uid())
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.has_company_access(company_id)
  AND (public.is_admin(auth.uid()) OR entered_by = auth.uid())
);

CREATE POLICY "Creator or admin can delete magazine_sales in company"
ON public.magazine_sales
FOR DELETE
TO authenticated
USING (
  public.has_company_access(company_id)
  AND (public.is_admin(auth.uid()) OR entered_by = auth.uid())
);
