-- =============================================================================
-- STEP 3: Create RLS Helper Functions and Apply Company-Scoped Policies
-- =============================================================================

-- 1. Create function to get current user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id 
  FROM public.profiles 
  WHERE id = auth.uid()
$$;

-- 2. Create function to check if user belongs to a corporation
CREATE OR REPLACE FUNCTION public.user_in_corporation(corp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.companies c ON p.company_id = c.id
    WHERE p.id = auth.uid() 
    AND c.corporation_id = corp_id
  )
$$;

-- 3. Create function to get user's corporation_id
CREATE OR REPLACE FUNCTION public.get_user_corporation_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.corporation_id
  FROM public.profiles p
  JOIN public.companies c ON p.company_id = c.id
  WHERE p.id = auth.uid()
$$;

-- 4. Create function to check if user is corp_admin or super_admin
CREATE OR REPLACE FUNCTION public.is_corp_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'corp_admin')
  )
$$;

-- 5. Create function to check company access (includes corp-level access)
CREATE OR REPLACE FUNCTION public.has_company_access(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Direct company access
    target_company_id = public.get_user_company_id()
    OR
    -- Corp admin can access all companies in their corporation
    (
      public.is_corp_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.companies c1
        JOIN public.companies c2 ON c1.corporation_id = c2.corporation_id
        WHERE c1.id = target_company_id
        AND c2.id = public.get_user_company_id()
      )
    )
$$;

-- =============================================================================
-- 6. Update RLS Policies on Tenant Tables (corporations, companies, etc.)
-- =============================================================================

-- Drop temporary policies on corporations
DROP POLICY IF EXISTS "Allow authenticated read corporations" ON corporations;
DROP POLICY IF EXISTS "Allow admins manage corporations" ON corporations;

-- Corporation policies - users can only see their own corporation
CREATE POLICY "Users can view their corporation"
ON corporations FOR SELECT TO authenticated
USING (
  id = public.get_user_corporation_id()
  OR public.is_corp_admin(auth.uid())
);

CREATE POLICY "Corp admins can manage corporations"
ON corporations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Drop temporary policies on companies
DROP POLICY IF EXISTS "Allow authenticated read companies" ON companies;
DROP POLICY IF EXISTS "Allow admins manage companies" ON companies;

-- Companies policies
CREATE POLICY "Users can view companies in their corporation"
ON companies FOR SELECT TO authenticated
USING (
  id = public.get_user_company_id()
  OR public.user_in_corporation(corporation_id)
);

CREATE POLICY "Admins can manage companies"
ON companies FOR ALL TO authenticated
USING (public.is_corp_admin(auth.uid()) OR public.is_admin(auth.uid()))
WITH CHECK (public.is_corp_admin(auth.uid()) OR public.is_admin(auth.uid()));

-- Drop temporary policies on company_settings
DROP POLICY IF EXISTS "Allow authenticated read company_settings" ON company_settings;
DROP POLICY IF EXISTS "Allow admins manage company_settings" ON company_settings;

-- Company settings policies
CREATE POLICY "Users can view their company settings"
ON company_settings FOR SELECT TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "Admins can manage company settings"
ON company_settings FOR ALL TO authenticated
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- Drop temporary policies on company_integrations
DROP POLICY IF EXISTS "Allow authenticated read company_integrations" ON company_integrations;
DROP POLICY IF EXISTS "Allow admins manage company_integrations" ON company_integrations;

-- Company integrations policies
CREATE POLICY "Users can view their company integrations"
ON company_integrations FOR SELECT TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "Admins can manage company integrations"
ON company_integrations FOR ALL TO authenticated
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- =============================================================================
-- 7. Apply Company-Scoped RLS Policies to All Data Tables
-- Note: We're adding company-scoped policies alongside existing policies
-- =============================================================================

-- PROFILES table - add company scope to existing policies
CREATE POLICY "Users view profiles in their company"
ON profiles FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users update own profile in their company"
ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid() AND (company_id IS NULL OR public.has_company_access(company_id)))
WITH CHECK (id = auth.uid() AND (company_id IS NULL OR public.has_company_access(company_id)));

-- USER_ROLES table
CREATE POLICY "Users view roles in their company"
ON user_roles FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- CONTACTS table
CREATE POLICY "Users view contacts in their company"
ON contacts FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage contacts in their company"
ON contacts FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- OPPORTUNITIES table
CREATE POLICY "Users view opportunities in their company"
ON opportunities FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage opportunities in their company"
ON opportunities FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- APPOINTMENTS table
CREATE POLICY "Users view appointments in their company"
ON appointments FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage appointments in their company"
ON appointments FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- CONVERSATIONS table
CREATE POLICY "Users view conversations in their company"
ON conversations FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- GHL_TASKS table
CREATE POLICY "Users view tasks in their company"
ON ghl_tasks FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage tasks in their company"
ON ghl_tasks FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- CONTACT_NOTES table
CREATE POLICY "Users view notes in their company"
ON contact_notes FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage notes in their company"
ON contact_notes FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- CALL_LOGS table
CREATE POLICY "Users view call logs in their company"
ON call_logs FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- GHL_USERS table
CREATE POLICY "Users view ghl users in their company"
ON ghl_users FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- GHL_CALENDARS table
CREATE POLICY "Users view calendars in their company"
ON ghl_calendars FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- GHL_PIPELINES table
CREATE POLICY "Users view pipelines in their company"
ON ghl_pipelines FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- TASKS table
CREATE POLICY "Users view general tasks in their company"
ON tasks FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage general tasks in their company"
ON tasks FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- SALESPEOPLE table
CREATE POLICY "Users view salespeople in their company"
ON salespeople FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Admins manage salespeople in their company"
ON salespeople FOR ALL TO authenticated
USING ((company_id IS NULL OR public.has_company_access(company_id)) AND public.is_admin(auth.uid()))
WITH CHECK ((company_id IS NULL OR public.has_company_access(company_id)) AND public.is_admin(auth.uid()));

-- SUBCONTRACTORS table
CREATE POLICY "Users view subcontractors in their company"
ON subcontractors FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Admins manage subcontractors in their company"
ON subcontractors FOR ALL TO authenticated
USING ((company_id IS NULL OR public.has_company_access(company_id)) AND public.is_admin(auth.uid()))
WITH CHECK ((company_id IS NULL OR public.has_company_access(company_id)) AND public.is_admin(auth.uid()));

-- BANKS table
CREATE POLICY "Users view banks in their company"
ON banks FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- TRADES table
CREATE POLICY "Users view trades in their company"
ON trades FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- ESTIMATES table
CREATE POLICY "Users view estimates in their company"
ON estimates FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage estimates in their company"
ON estimates FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- ESTIMATE_LINE_ITEMS table
CREATE POLICY "Users view estimate items in their company"
ON estimate_line_items FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage estimate items in their company"
ON estimate_line_items FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- ESTIMATE_GROUPS table
CREATE POLICY "Users view estimate groups in their company"
ON estimate_groups FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage estimate groups in their company"
ON estimate_groups FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- ESTIMATE_SIGNERS table
CREATE POLICY "Users view estimate signers in their company"
ON estimate_signers FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage estimate signers in their company"
ON estimate_signers FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- ESTIMATE_SIGNATURES table
CREATE POLICY "Users view estimate signatures in their company"
ON estimate_signatures FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- ESTIMATE_ATTACHMENTS table
CREATE POLICY "Users view estimate attachments in their company"
ON estimate_attachments FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage estimate attachments in their company"
ON estimate_attachments FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- ESTIMATE_PAYMENT_SCHEDULE table
CREATE POLICY "Users view estimate payment schedule in their company"
ON estimate_payment_schedule FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage estimate payment schedule in their company"
ON estimate_payment_schedule FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECTS table
CREATE POLICY "Users view projects in their company"
ON projects FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage projects in their company"
ON projects FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_INVOICES table
CREATE POLICY "Users view project invoices in their company"
ON project_invoices FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project invoices in their company"
ON project_invoices FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_BILLS table
CREATE POLICY "Users view project bills in their company"
ON project_bills FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project bills in their company"
ON project_bills FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_PAYMENTS table
CREATE POLICY "Users view project payments in their company"
ON project_payments FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project payments in their company"
ON project_payments FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_PAYMENT_PHASES table
CREATE POLICY "Users view payment phases in their company"
ON project_payment_phases FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage payment phases in their company"
ON project_payment_phases FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_DOCUMENTS table
CREATE POLICY "Users view project documents in their company"
ON project_documents FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project documents in their company"
ON project_documents FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_NOTES table
CREATE POLICY "Users view project notes in their company"
ON project_notes FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project notes in their company"
ON project_notes FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_NOTE_COMMENTS table
CREATE POLICY "Users view project note comments in their company"
ON project_note_comments FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project note comments in their company"
ON project_note_comments FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_AGREEMENTS table
CREATE POLICY "Users view project agreements in their company"
ON project_agreements FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project agreements in their company"
ON project_agreements FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_COSTS table
CREATE POLICY "Users view project costs in their company"
ON project_costs FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project costs in their company"
ON project_costs FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_COMMISSIONS table
CREATE POLICY "Users view project commissions in their company"
ON project_commissions FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project commissions in their company"
ON project_commissions FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_CHECKLISTS table
CREATE POLICY "Users view project checklists in their company"
ON project_checklists FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project checklists in their company"
ON project_checklists FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_STATUSES table
CREATE POLICY "Users view project statuses in their company"
ON project_statuses FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_TYPES table
CREATE POLICY "Users view project types in their company"
ON project_types FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_FEEDBACK table
CREATE POLICY "Users view project feedback in their company"
ON project_feedback FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project feedback in their company"
ON project_feedback FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_MESSAGES table
CREATE POLICY "Users view project messages in their company"
ON project_messages FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project messages in their company"
ON project_messages FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_CASES table
CREATE POLICY "Users view project cases in their company"
ON project_cases FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project cases in their company"
ON project_cases FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_FINANCE table
CREATE POLICY "Users view project finance in their company"
ON project_finance FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage project finance in their company"
ON project_finance FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- SIGNATURE_DOCUMENTS table
CREATE POLICY "Users view signature documents in their company"
ON signature_documents FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage signature documents in their company"
ON signature_documents FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- SIGNATURE_FIELD_TEMPLATES table
CREATE POLICY "Users view signature templates in their company"
ON signature_field_templates FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage signature templates in their company"
ON signature_field_templates FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- SIGNATURE_FIELD_TEMPLATE_ITEMS table
CREATE POLICY "Users view signature template items in their company"
ON signature_field_template_items FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage signature template items in their company"
ON signature_field_template_items FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- DOCUMENT_SIGNATURES table
CREATE POLICY "Users view document signatures in their company"
ON document_signatures FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- DOCUMENT_SIGNERS table
CREATE POLICY "Users view document signers in their company"
ON document_signers FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage document signers in their company"
ON document_signers FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- DOCUMENT_SIGNATURE_FIELDS table
CREATE POLICY "Users view document fields in their company"
ON document_signature_fields FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage document fields in their company"
ON document_signature_fields FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- AUDIT_LOGS table
CREATE POLICY "Users view audit logs in their company"
ON audit_logs FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- NOTIFICATIONS table
CREATE POLICY "Users view notifications in their company"
ON notifications FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage notifications in their company"
ON notifications FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- OPPORTUNITY_SALES table
CREATE POLICY "Users view opportunity sales in their company"
ON opportunity_sales FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage opportunity sales in their company"
ON opportunity_sales FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- MAGAZINE_SALES table
CREATE POLICY "Users view magazine sales in their company"
ON magazine_sales FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage magazine sales in their company"
ON magazine_sales FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- MAGAZINE_SALES_EDITS table
CREATE POLICY "Users view magazine sales edits in their company"
ON magazine_sales_edits FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- OPPORTUNITY_EDITS table
CREATE POLICY "Users view opportunity edits in their company"
ON opportunity_edits FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- APPOINTMENT_EDITS table
CREATE POLICY "Users view appointment edits in their company"
ON appointment_edits FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- TASK_EDITS table
CREATE POLICY "Users view task edits in their company"
ON task_edits FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- NOTE_EDITS table
CREATE POLICY "Users view note edits in their company"
ON note_edits FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- APPOINTMENT_REMINDERS table
CREATE POLICY "Users view appointment reminders in their company"
ON appointment_reminders FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- PROJECT_NOTIFICATION_LOG table
CREATE POLICY "Users view project notification log in their company"
ON project_notification_log FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

-- BILL_PAYMENTS table
CREATE POLICY "Users view bill payments in their company"
ON bill_payments FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage bill payments in their company"
ON bill_payments FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- COMMISSION_PAYMENTS table
CREATE POLICY "Users view commission payments in their company"
ON commission_payments FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));

CREATE POLICY "Users manage commission payments in their company"
ON commission_payments FOR ALL TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id))
WITH CHECK (company_id IS NULL OR public.has_company_access(company_id));

-- IMPORTED_RECORDS table
CREATE POLICY "Users view imported records in their company"
ON imported_records FOR SELECT TO authenticated
USING (company_id IS NULL OR public.has_company_access(company_id));