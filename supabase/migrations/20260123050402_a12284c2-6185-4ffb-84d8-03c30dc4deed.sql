
-- =====================================================
-- FIX HIGH-RISK RLS POLICIES
-- =====================================================

-- =====================================================
-- 1. FIX: estimate_portal_tokens - Add company filtering
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view estimate portal tokens" ON public.estimate_portal_tokens;
DROP POLICY IF EXISTS "Authenticated users can update estimate portal tokens" ON public.estimate_portal_tokens;
DROP POLICY IF EXISTS "Authenticated users can delete estimate portal tokens" ON public.estimate_portal_tokens;
DROP POLICY IF EXISTS "Authenticated users can insert estimate portal tokens" ON public.estimate_portal_tokens;

-- Recreate with company isolation
CREATE POLICY "Users can view estimate_portal_tokens in their company"
  ON public.estimate_portal_tokens FOR SELECT
  USING (has_company_access(company_id));

CREATE POLICY "Users can insert estimate_portal_tokens in their company"
  ON public.estimate_portal_tokens FOR INSERT
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can update estimate_portal_tokens in their company"
  ON public.estimate_portal_tokens FOR UPDATE
  USING (has_company_access(company_id))
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can delete estimate_portal_tokens in their company"
  ON public.estimate_portal_tokens FOR DELETE
  USING (has_company_access(company_id));

-- =====================================================
-- 2. FIX: estimate_signers - Add company filtering
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view estimate signers" ON public.estimate_signers;
DROP POLICY IF EXISTS "Authenticated users can insert estimate signers" ON public.estimate_signers;
DROP POLICY IF EXISTS "Authenticated users can update estimate signers" ON public.estimate_signers;
DROP POLICY IF EXISTS "Authenticated users can delete estimate signers" ON public.estimate_signers;

-- Recreate with company isolation
CREATE POLICY "Users can view estimate_signers in their company"
  ON public.estimate_signers FOR SELECT
  USING (has_company_access(company_id));

CREATE POLICY "Users can insert estimate_signers in their company"
  ON public.estimate_signers FOR INSERT
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can update estimate_signers in their company"
  ON public.estimate_signers FOR UPDATE
  USING (has_company_access(company_id))
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can delete estimate_signers in their company"
  ON public.estimate_signers FOR DELETE
  USING (has_company_access(company_id));

-- =====================================================
-- 3. FIX: call_logs - Remove public read, add company checks
-- =====================================================

DROP POLICY IF EXISTS "Allow public read access" ON public.call_logs;
DROP POLICY IF EXISTS "Allow service role full access" ON public.call_logs;

-- Keep service role for edge functions, add company isolation for users
CREATE POLICY "Users can view call_logs in their company"
  ON public.call_logs FOR SELECT
  USING (has_company_access(company_id));

CREATE POLICY "Users can insert call_logs in their company"
  ON public.call_logs FOR INSERT
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can update call_logs in their company"
  ON public.call_logs FOR UPDATE
  USING (has_company_access(company_id));

CREATE POLICY "Users can delete call_logs in their company"
  ON public.call_logs FOR DELETE
  USING (has_company_access(company_id) AND is_admin(auth.uid()));

-- =====================================================
-- 4. FIX: contact_notes - Remove public read, add company checks
-- =====================================================

DROP POLICY IF EXISTS "Allow public read access" ON public.contact_notes;
DROP POLICY IF EXISTS "Allow service role full access" ON public.contact_notes;
-- Keep the existing company-scoped policies if they exist
DROP POLICY IF EXISTS "Users view notes in their company" ON public.contact_notes;
DROP POLICY IF EXISTS "Users manage notes in their company" ON public.contact_notes;

-- Recreate with proper company isolation
CREATE POLICY "Users can view contact_notes in their company"
  ON public.contact_notes FOR SELECT
  USING (has_company_access(company_id));

CREATE POLICY "Users can insert contact_notes in their company"
  ON public.contact_notes FOR INSERT
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can update contact_notes in their company"
  ON public.contact_notes FOR UPDATE
  USING (has_company_access(company_id));

CREATE POLICY "Users can delete contact_notes in their company"
  ON public.contact_notes FOR DELETE
  USING (has_company_access(company_id));

-- =====================================================
-- 5. FIX: conversations - Remove public read, add company checks
-- =====================================================

DROP POLICY IF EXISTS "Allow public read access" ON public.conversations;
DROP POLICY IF EXISTS "Allow service role full access" ON public.conversations;
DROP POLICY IF EXISTS "Users view conversations in their company" ON public.conversations;

-- Recreate with proper company isolation
CREATE POLICY "Users can view conversations in their company"
  ON public.conversations FOR SELECT
  USING (has_company_access(company_id));

CREATE POLICY "Users can insert conversations in their company"
  ON public.conversations FOR INSERT
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can update conversations in their company"
  ON public.conversations FOR UPDATE
  USING (has_company_access(company_id));

-- =====================================================
-- 6. FIX: ghl_tasks - Remove public read, add company checks
-- =====================================================

DROP POLICY IF EXISTS "Allow public read access" ON public.ghl_tasks;
DROP POLICY IF EXISTS "Allow service role full access" ON public.ghl_tasks;
DROP POLICY IF EXISTS "Users view tasks in their company" ON public.ghl_tasks;

-- Recreate with proper company isolation
CREATE POLICY "Users can view ghl_tasks in their company"
  ON public.ghl_tasks FOR SELECT
  USING (has_company_access(company_id));

CREATE POLICY "Users can insert ghl_tasks in their company"
  ON public.ghl_tasks FOR INSERT
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can update ghl_tasks in their company"
  ON public.ghl_tasks FOR UPDATE
  USING (has_company_access(company_id));

CREATE POLICY "Users can delete ghl_tasks in their company"
  ON public.ghl_tasks FOR DELETE
  USING (has_company_access(company_id));

-- =====================================================
-- 7. FIX: ghl_users - Remove public read, add company checks
-- =====================================================

DROP POLICY IF EXISTS "Allow public read access" ON public.ghl_users;
DROP POLICY IF EXISTS "Allow service role full access" ON public.ghl_users;
DROP POLICY IF EXISTS "Users view ghl_users in their company" ON public.ghl_users;

-- Recreate with proper company isolation
CREATE POLICY "Users can view ghl_users in their company"
  ON public.ghl_users FOR SELECT
  USING (has_company_access(company_id));

CREATE POLICY "Users can insert ghl_users in their company"
  ON public.ghl_users FOR INSERT
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "Users can update ghl_users in their company"
  ON public.ghl_users FOR UPDATE
  USING (has_company_access(company_id));
