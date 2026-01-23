
-- =====================================================
-- RLS POLICY CONSOLIDATION & CLEANUP
-- =====================================================
-- This migration:
-- 1. Removes duplicate/redundant policies
-- 2. Removes legacy "service role full access" policies (service role bypasses RLS anyway)
-- 3. Removes overly permissive USING(true) policies where company-scoped versions exist
-- 4. Keeps intentional public read policies (documented below)
-- =====================================================

-- =====================================================
-- CLEANUP: appointment_edits - has both USING(true) and company-scoped
-- =====================================================
DROP POLICY IF EXISTS "Allow authenticated read access on appointment_edits" ON public.appointment_edits;
DROP POLICY IF EXISTS "Allow service role full access on appointment_edits" ON public.appointment_edits;
-- Keep: "Users view appointment edits in their company" (company-scoped)

-- =====================================================
-- CLEANUP: appointment_reminders - has both USING(true) and company-scoped
-- =====================================================
DROP POLICY IF EXISTS "Allow authenticated read access on reminders" ON public.appointment_reminders;
DROP POLICY IF EXISTS "Allow service role full access on reminders" ON public.appointment_reminders;
-- Keep: "Users view appointment reminders in their company" (company-scoped)

-- =====================================================
-- CLEANUP: banks - has duplicate SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "Users view banks in their company" ON public.banks;
-- Keep: "Users can view banks in their company" (newer, simpler)

-- =====================================================
-- CLEANUP: call_logs - remove duplicate SELECT
-- =====================================================
DROP POLICY IF EXISTS "Users view call logs in their company" ON public.call_logs;
-- Keep: "Users can view call_logs in their company" (newer)

-- =====================================================
-- CLEANUP: document_signature_fields - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users manage document fields in their company" ON public.document_signature_fields;
DROP POLICY IF EXISTS "Users view document fields in their company" ON public.document_signature_fields;
-- Keep: Company users can [verb] signature fields (granular)

-- =====================================================
-- CLEANUP: document_signatures - remove duplicate SELECT
-- =====================================================
DROP POLICY IF EXISTS "Users view document signatures in their company" ON public.document_signatures;
-- Keep: "Authenticated users can view signatures" + portal token policy

-- =====================================================
-- CLEANUP: document_signers - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users manage document signers in their company" ON public.document_signers;
DROP POLICY IF EXISTS "Users view document signers in their company" ON public.document_signers;
-- Keep: granular company policies

-- =====================================================
-- CLEANUP: estimate_attachments - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users manage estimate attachments in their company" ON public.estimate_attachments;
DROP POLICY IF EXISTS "Users view estimate attachments in their company" ON public.estimate_attachments;
-- Keep: role-based policies (admin/contract_manager)

-- =====================================================
-- CLEANUP: estimate_groups - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users manage estimate groups in their company" ON public.estimate_groups;
DROP POLICY IF EXISTS "Users view estimate groups in their company" ON public.estimate_groups;
-- Keep: role-based + portal token policies

-- =====================================================
-- CLEANUP: estimate_line_items - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users manage estimate items in their company" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Users view estimate items in their company" ON public.estimate_line_items;
-- Keep: role-based + portal token policies

-- =====================================================
-- CLEANUP: estimate_payment_schedule - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users manage estimate payment schedule in their company" ON public.estimate_payment_schedule;
DROP POLICY IF EXISTS "Users view estimate payment schedule in their company" ON public.estimate_payment_schedule;
-- Keep: role-based + portal token policies

-- =====================================================
-- CLEANUP: estimate_signers - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users manage estimate signers in their company" ON public.estimate_signers;
DROP POLICY IF EXISTS "Users view estimate signers in their company" ON public.estimate_signers;
-- Keep: granular company + portal token policies

-- =====================================================
-- CLEANUP: ghl_calendars - remove USING(true), keep company-scoped
-- =====================================================
DROP POLICY IF EXISTS "Users can view calendars" ON public.ghl_calendars;
-- Keep: "Users view calendars in their company" (company-scoped)

-- =====================================================
-- CLEANUP: ghl_field_mappings - USING(true) is intentional for lookup
-- (field mappings are company-specific but need lookup access)
-- =====================================================
-- KEEP: "Users can view field mappings" - INTENTIONAL for config lookup

-- =====================================================
-- CLEANUP: ghl_pipelines - remove USING(true), keep company-scoped
-- =====================================================
DROP POLICY IF EXISTS "Users can view pipelines" ON public.ghl_pipelines;
-- Keep: "Users view pipelines in their company" (company-scoped)

-- =====================================================
-- CLEANUP: ghl_tasks - has many duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users manage tasks in their company" ON public.ghl_tasks;
DROP POLICY IF EXISTS "Users view ghl_tasks in their company" ON public.ghl_tasks;
-- Keep: granular company policies + admin/super_admin

-- =====================================================
-- CLEANUP: ghl_users - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users view ghl users in their company" ON public.ghl_users;
-- Keep: granular company policies

-- =====================================================
-- CLEANUP: imported_records - remove USING(true) policies
-- =====================================================
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.imported_records;
DROP POLICY IF EXISTS "Allow service role full access" ON public.imported_records;
-- Keep: "Users view imported records in their company" (company-scoped)

-- =====================================================
-- CLEANUP: note_edits - remove USING(true), keep company-scoped
-- =====================================================
DROP POLICY IF EXISTS "Allow authenticated read access on note_edits" ON public.note_edits;
DROP POLICY IF EXISTS "Allow service role full access on note_edits" ON public.note_edits;
-- Keep: "Users view note edits in their company" (company-scoped)

-- =====================================================
-- CLEANUP: opportunity_edits - remove USING(true), keep company-scoped
-- =====================================================
DROP POLICY IF EXISTS "Allow authenticated read access on opportunity_edits" ON public.opportunity_edits;
DROP POLICY IF EXISTS "Allow service role full access on opportunity_edits" ON public.opportunity_edits;
-- Keep: "Users view opportunity edits in their company" (company-scoped)

-- =====================================================
-- CLEANUP: task_edits - remove USING(true), keep company-scoped
-- =====================================================
DROP POLICY IF EXISTS "Allow authenticated read access on task_edits" ON public.task_edits;
DROP POLICY IF EXISTS "Allow service role full access on task_edits" ON public.task_edits;
-- Keep: "Users view task edits in their company" (company-scoped)

-- =====================================================
-- CLEANUP: tasks - has many duplicates (9 policies!)
-- =====================================================
DROP POLICY IF EXISTS "Users view tasks in their company" ON public.tasks;
DROP POLICY IF EXISTS "Users view general tasks in their company" ON public.tasks;
DROP POLICY IF EXISTS "Users manage tasks in their company" ON public.tasks;
DROP POLICY IF EXISTS "Users manage general tasks in their company" ON public.tasks;
-- Keep: granular "Users can [verb] tasks in their company" + super_admin

-- =====================================================
-- CLEANUP: project_* tables - remove service role policies (redundant)
-- =====================================================
DROP POLICY IF EXISTS "Service role project_agreements" ON public.project_agreements;
DROP POLICY IF EXISTS "Service role project_checklists" ON public.project_checklists;
DROP POLICY IF EXISTS "Service role project_commissions" ON public.project_commissions;
DROP POLICY IF EXISTS "Service role project_documents" ON public.project_documents;
DROP POLICY IF EXISTS "Service role project_feedback" ON public.project_feedback;
DROP POLICY IF EXISTS "Service role project_finance" ON public.project_finance;
DROP POLICY IF EXISTS "Service role project_messages" ON public.project_messages;

-- =====================================================
-- CLEANUP: signature_documents - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users view signature_documents in their company" ON public.signature_documents;
DROP POLICY IF EXISTS "Users manage signature_documents in their company" ON public.signature_documents;
DROP POLICY IF EXISTS "Public can view documents via valid token" ON public.signature_documents;
DROP POLICY IF EXISTS "Public can update documents via valid token" ON public.signature_documents;
-- Keep: portal token policies + company-scoped

-- =====================================================
-- CLEANUP: signature_field_templates - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users manage signature templates in their company" ON public.signature_field_templates;
DROP POLICY IF EXISTS "Users manage signature_field_templates in their company" ON public.signature_field_templates;
DROP POLICY IF EXISTS "Users view signature templates in their company" ON public.signature_field_templates;
DROP POLICY IF EXISTS "Users view signature_field_templates in their company" ON public.signature_field_templates;
-- Keep: "Authenticated users can view/create templates" + owner-based

-- =====================================================
-- CLEANUP: signature_field_template_items - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users manage signature_field_template_items in their company" ON public.signature_field_template_items;
DROP POLICY IF EXISTS "Users view signature_field_template_items in their company" ON public.signature_field_template_items;
-- Keep: "Authenticated users can [verb] template items"

-- =====================================================
-- CLEANUP: project_payment_phases - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users manage payment phases in their company" ON public.project_payment_phases;
DROP POLICY IF EXISTS "Users view payment phases in their company" ON public.project_payment_phases;
-- Keep: granular company + portal policies

-- =====================================================
-- CLEANUP: trades - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Admins manage trades in their company" ON public.trades;
-- Keep: super_admin policies + view policy

-- =====================================================
-- CLEANUP: user_roles - has duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users view roles in their company" ON public.user_roles;
DROP POLICY IF EXISTS "Company admins can manage roles in their company" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles in their company" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
-- Keep: user's own role access + super_admin

-- =====================================================
-- DOCUMENT: Intentional USING(true) policies (PUBLIC READ)
-- These are kept intentionally for specific use cases:
-- =====================================================
-- 1. app_version: "Anyone can view app version" - version check for clients
-- 2. ghl_field_mappings: "Users can view field mappings" - config lookup
-- 3. subscription_features: "Anyone can view subscription features" - public pricing
-- 4. subscription_plans: "Anyone can view active subscription plans" - public pricing
-- 5. project_statuses: "Anyone can read project_statuses" - shared lookup table
-- 6. project_types: "Anyone can read project_types" - shared lookup table
-- 7. trades: "Anyone can view trades" - shared lookup table
-- =====================================================

-- =====================================================
-- Add INSERT policy for imported_records (was only service role)
-- =====================================================
CREATE POLICY "Users can insert imported_records in their company"
  ON public.imported_records FOR INSERT
  WITH CHECK (has_company_access(company_id));
