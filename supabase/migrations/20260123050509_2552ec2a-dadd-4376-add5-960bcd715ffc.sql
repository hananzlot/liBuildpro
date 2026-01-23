
-- =====================================================
-- FIX: banks table - Add company_id checks to SELECT policy
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view banks" ON public.banks;

-- Create proper company-isolated SELECT policy
CREATE POLICY "Users can view banks in their company"
  ON public.banks FOR SELECT
  USING (has_company_access(company_id));
