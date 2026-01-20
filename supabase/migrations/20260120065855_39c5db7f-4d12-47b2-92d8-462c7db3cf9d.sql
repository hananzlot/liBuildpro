-- =====================================================
-- FIX: Remaining cross-company leaks (project_payments, audit_logs, salespeople)
-- =====================================================

-- ========================
-- project_payments: Remove role-only policies (no company_id check)
-- ========================
DROP POLICY IF EXISTS "Production or admin can read project_payments" ON public.project_payments;
DROP POLICY IF EXISTS "Production or admin can insert project_payments" ON public.project_payments;
DROP POLICY IF EXISTS "Production or admin can update project_payments" ON public.project_payments;
DROP POLICY IF EXISTS "Production or admin can delete project_payments" ON public.project_payments;
DROP POLICY IF EXISTS "Service role project_payments" ON public.project_payments;

-- ========================
-- audit_logs: Admin policy currently bypasses company scoping
-- ========================
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- Tighten INSERT so authenticated users can only write logs for their company
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert audit logs in their company"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (has_company_access(company_id));

-- ========================
-- salespeople: Remove permissive policies that expose all rows cross-company
-- ========================
DROP POLICY IF EXISTS "Authenticated users can view salespeople" ON public.salespeople;
DROP POLICY IF EXISTS "Portal can view salespeople" ON public.salespeople;
DROP POLICY IF EXISTS "Admins can insert salespeople" ON public.salespeople;
DROP POLICY IF EXISTS "Admins can update salespeople" ON public.salespeople;
DROP POLICY IF EXISTS "Admins can delete salespeople" ON public.salespeople;