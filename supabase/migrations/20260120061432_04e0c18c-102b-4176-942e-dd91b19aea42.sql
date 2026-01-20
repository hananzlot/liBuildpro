
-- Fix remaining tables from where the previous migration failed

-- =============================================
-- TABLE: salespeople (fix the duplicate policy issue)
-- =============================================
DROP POLICY IF EXISTS "Admins manage salespeople in their company" ON public.salespeople;
DROP POLICY IF EXISTS "Super admins full access to salespeople" ON public.salespeople;
DROP POLICY IF EXISTS "Users view salespeople in their company" ON public.salespeople;

CREATE POLICY "Super admins full access to salespeople"
ON public.salespeople FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view salespeople in their company"
ON public.salespeople FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Admins manage salespeople in their company"
ON public.salespeople FOR ALL
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- =============================================
-- TABLE: signature_documents
-- =============================================
DROP POLICY IF EXISTS "Super admins full access to signature_documents" ON public.signature_documents;
DROP POLICY IF EXISTS "Users view signature_documents in their company" ON public.signature_documents;
DROP POLICY IF EXISTS "Users manage signature_documents in their company" ON public.signature_documents;
DROP POLICY IF EXISTS "Public can view documents via valid token" ON public.signature_documents;
DROP POLICY IF EXISTS "Public can update documents via valid token" ON public.signature_documents;

CREATE POLICY "Super admins full access to signature_documents"
ON public.signature_documents FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view signature_documents in their company"
ON public.signature_documents FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Users manage signature_documents in their company"
ON public.signature_documents FOR ALL
USING (public.has_company_access(company_id))
WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Public can view documents via valid token"
ON public.signature_documents FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM document_portal_tokens dpt WHERE dpt.document_id = signature_documents.id AND dpt.is_active = true));

CREATE POLICY "Public can update documents via valid token"
ON public.signature_documents FOR UPDATE TO anon
USING (EXISTS (SELECT 1 FROM document_portal_tokens dpt WHERE dpt.document_id = signature_documents.id AND dpt.is_active = true));

-- =============================================
-- Remaining tables: signature_field_template_items, signature_field_templates, subcontractors, task_edits, tasks, trades, user_roles
-- =============================================

-- signature_field_template_items
DROP POLICY IF EXISTS "Super admins full access to signature_field_template_items" ON public.signature_field_template_items;
DROP POLICY IF EXISTS "Users view signature_field_template_items in their company" ON public.signature_field_template_items;
DROP POLICY IF EXISTS "Users manage signature_field_template_items in their company" ON public.signature_field_template_items;

CREATE POLICY "Super admins full access to signature_field_template_items"
ON public.signature_field_template_items FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view signature_field_template_items in their company"
ON public.signature_field_template_items FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Users manage signature_field_template_items in their company"
ON public.signature_field_template_items FOR ALL
USING (public.has_company_access(company_id))
WITH CHECK (public.has_company_access(company_id));

-- signature_field_templates
DROP POLICY IF EXISTS "Super admins full access to signature_field_templates" ON public.signature_field_templates;
DROP POLICY IF EXISTS "Users view signature_field_templates in their company" ON public.signature_field_templates;
DROP POLICY IF EXISTS "Users manage signature_field_templates in their company" ON public.signature_field_templates;

CREATE POLICY "Super admins full access to signature_field_templates"
ON public.signature_field_templates FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view signature_field_templates in their company"
ON public.signature_field_templates FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Users manage signature_field_templates in their company"
ON public.signature_field_templates FOR ALL
USING (public.has_company_access(company_id))
WITH CHECK (public.has_company_access(company_id));

-- subcontractors
DROP POLICY IF EXISTS "Super admins full access to subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Users view subcontractors in their company" ON public.subcontractors;
DROP POLICY IF EXISTS "Production or admin manage subcontractors" ON public.subcontractors;

CREATE POLICY "Super admins full access to subcontractors"
ON public.subcontractors FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view subcontractors in their company"
ON public.subcontractors FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Production or admin manage subcontractors"
ON public.subcontractors FOR ALL
USING (public.has_company_access(company_id) AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production')))
WITH CHECK (public.has_company_access(company_id) AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production')));

-- task_edits
DROP POLICY IF EXISTS "Super admins full access to task_edits" ON public.task_edits;
DROP POLICY IF EXISTS "Users view task_edits in their company" ON public.task_edits;

CREATE POLICY "Super admins full access to task_edits"
ON public.task_edits FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view task_edits in their company"
ON public.task_edits FOR SELECT
USING (public.has_company_access(company_id));

-- tasks
DROP POLICY IF EXISTS "Super admins full access to tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users view tasks in their company" ON public.tasks;
DROP POLICY IF EXISTS "Users manage tasks in their company" ON public.tasks;

CREATE POLICY "Super admins full access to tasks"
ON public.tasks FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view tasks in their company"
ON public.tasks FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Users manage tasks in their company"
ON public.tasks FOR ALL
USING (public.has_company_access(company_id))
WITH CHECK (public.has_company_access(company_id));

-- trades
DROP POLICY IF EXISTS "Super admins full access to trades" ON public.trades;
DROP POLICY IF EXISTS "Users view trades in their company" ON public.trades;
DROP POLICY IF EXISTS "Admins manage trades in their company" ON public.trades;

CREATE POLICY "Super admins full access to trades"
ON public.trades FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view trades in their company"
ON public.trades FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Admins manage trades in their company"
ON public.trades FOR ALL
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Company admins can manage roles in their company" ON public.user_roles;

CREATE POLICY "Super admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can read own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Company admins can manage roles in their company"
ON public.user_roles FOR ALL
USING (public.is_admin(auth.uid()) AND (company_id IS NULL OR public.has_company_access(company_id)))
WITH CHECK (public.is_admin(auth.uid()) AND (company_id IS NULL OR public.has_company_access(company_id)));
