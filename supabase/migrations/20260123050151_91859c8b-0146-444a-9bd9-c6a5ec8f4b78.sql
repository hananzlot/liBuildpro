
-- =====================================================
-- FIX CRITICAL RLS POLICIES: Cross-Company Data Leak Prevention
-- =====================================================

-- =====================================================
-- 1. FIX: tasks table - Currently allows ANY user full access
-- =====================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow public read access" ON public.tasks;
DROP POLICY IF EXISTS "Allow public update access" ON public.tasks;
DROP POLICY IF EXISTS "Allow public insert access" ON public.tasks;
DROP POLICY IF EXISTS "Allow public delete access" ON public.tasks;

-- Create proper company-isolated policies
CREATE POLICY "Users can view tasks in their company"
  ON public.tasks FOR SELECT
  USING (has_company_access(company_id));

CREATE POLICY "Users can insert tasks in their company"
  ON public.tasks FOR INSERT
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can update tasks in their company"
  ON public.tasks FOR UPDATE
  USING (has_company_access(company_id))
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can delete tasks in their company"
  ON public.tasks FOR DELETE
  USING (has_company_access(company_id));

-- =====================================================
-- 2. FIX: opportunity_sales table - No company isolation
-- =====================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow public read access on opportunity_sales" ON public.opportunity_sales;
DROP POLICY IF EXISTS "Allow authenticated insert on opportunity_sales" ON public.opportunity_sales;
DROP POLICY IF EXISTS "Allow authenticated update on opportunity_sales" ON public.opportunity_sales;
DROP POLICY IF EXISTS "Allow authenticated delete on opportunity_sales" ON public.opportunity_sales;

-- Create proper company-isolated policies
CREATE POLICY "Users can view opportunity_sales in their company"
  ON public.opportunity_sales FOR SELECT
  USING (has_company_access(company_id));

CREATE POLICY "Users can insert opportunity_sales in their company"
  ON public.opportunity_sales FOR INSERT
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can update opportunity_sales in their company"
  ON public.opportunity_sales FOR UPDATE
  USING (has_company_access(company_id))
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can delete opportunity_sales in their company"
  ON public.opportunity_sales FOR DELETE
  USING (has_company_access(company_id));

-- =====================================================
-- 3. FIX: project_costs table - Financial data exposed
-- =====================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated read access on project_costs" ON public.project_costs;
DROP POLICY IF EXISTS "Allow authenticated insert on project_costs" ON public.project_costs;
DROP POLICY IF EXISTS "Allow authenticated update on project_costs" ON public.project_costs;
DROP POLICY IF EXISTS "Allow authenticated delete on project_costs" ON public.project_costs;

-- Create proper company-isolated policies
CREATE POLICY "Users can view project_costs in their company"
  ON public.project_costs FOR SELECT
  USING (has_company_access(company_id));

CREATE POLICY "Users can insert project_costs in their company"
  ON public.project_costs FOR INSERT
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can update project_costs in their company"
  ON public.project_costs FOR UPDATE
  USING (has_company_access(company_id))
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can delete project_costs in their company"
  ON public.project_costs FOR DELETE
  USING (has_company_access(company_id));

-- =====================================================
-- 4. FIX: project_payment_phases table - Payment schedules exposed
-- =====================================================

-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Allow all access to payment phases" ON public.project_payment_phases;

-- Create proper company-isolated policies
CREATE POLICY "Users can view payment_phases in their company"
  ON public.project_payment_phases FOR SELECT
  USING (has_company_access(company_id));

CREATE POLICY "Users can insert payment_phases in their company"
  ON public.project_payment_phases FOR INSERT
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can update payment_phases in their company"
  ON public.project_payment_phases FOR UPDATE
  USING (has_company_access(company_id))
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can delete payment_phases in their company"
  ON public.project_payment_phases FOR DELETE
  USING (has_company_access(company_id));

-- Also add portal access for project_payment_phases (customers viewing their payment schedule)
CREATE POLICY "Portal can read payment_phases via token"
  ON public.project_payment_phases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_portal_tokens cpt
      WHERE cpt.project_id = project_payment_phases.project_id
        AND cpt.is_active = true
        AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
    )
  );
