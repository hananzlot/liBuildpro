-- Step 1: Drop the function with CASCADE (this will drop all dependent policies)
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;

-- Step 2: Create new enum type
CREATE TYPE public.app_role_new AS ENUM ('super_admin', 'admin', 'magazine', 'production', 'dispatch', 'sales');

-- Step 3: Update the user_roles table to use the new enum
ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE public.app_role_new 
  USING (
    CASE role::text
      WHEN 'admin' THEN 'super_admin'::public.app_role_new
      WHEN 'user' THEN 'sales'::public.app_role_new
      WHEN 'magazine_editor' THEN 'magazine'::public.app_role_new
      WHEN 'production' THEN 'production'::public.app_role_new
      ELSE 'sales'::public.app_role_new
    END
  );

-- Step 4: Drop the old enum and rename the new one
DROP TYPE public.app_role;
ALTER TYPE public.app_role_new RENAME TO app_role;

-- Step 5: Recreate the has_role function with new enum
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 6: Create helper function for admin check (super_admin or admin)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin')
  )
$$;

-- Step 7: Recreate all policies with new roles
-- User roles policies
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()));

-- Magazine sales policies  
CREATE POLICY "Magazine or admin can read magazine_sales" ON public.magazine_sales
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'magazine'));

CREATE POLICY "Magazine or admin can insert magazine_sales" ON public.magazine_sales
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'magazine'));

CREATE POLICY "Creator or admin can update magazine_sales" ON public.magazine_sales
  FOR UPDATE USING (public.is_admin(auth.uid()) OR entered_by = auth.uid());

CREATE POLICY "Creator or admin can delete magazine_sales" ON public.magazine_sales
  FOR DELETE USING (public.is_admin(auth.uid()) OR entered_by = auth.uid());

-- Magazine sales edits policies
CREATE POLICY "Magazine or admin can read magazine_sales_edits" ON public.magazine_sales_edits
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'magazine'));

CREATE POLICY "Magazine or admin can insert magazine_sales_edits" ON public.magazine_sales_edits
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'magazine'));

-- Projects policies
CREATE POLICY "Production or admin can read projects" ON public.projects
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert projects" ON public.projects
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update projects" ON public.projects
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete projects" ON public.projects
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

-- Project finance policies
CREATE POLICY "Production or admin can read project_finance" ON public.project_finance
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert project_finance" ON public.project_finance
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update project_finance" ON public.project_finance
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete project_finance" ON public.project_finance
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

-- Project agreements policies
CREATE POLICY "Production or admin can read project_agreements" ON public.project_agreements
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert project_agreements" ON public.project_agreements
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update project_agreements" ON public.project_agreements
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete project_agreements" ON public.project_agreements
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

-- Project invoices policies
CREATE POLICY "Production or admin can read project_invoices" ON public.project_invoices
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert project_invoices" ON public.project_invoices
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update project_invoices" ON public.project_invoices
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete project_invoices" ON public.project_invoices
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

-- Project payments policies
CREATE POLICY "Production or admin can read project_payments" ON public.project_payments
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert project_payments" ON public.project_payments
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update project_payments" ON public.project_payments
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete project_payments" ON public.project_payments
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

-- Project bills policies
CREATE POLICY "Production or admin can read project_bills" ON public.project_bills
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert project_bills" ON public.project_bills
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update project_bills" ON public.project_bills
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete project_bills" ON public.project_bills
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

-- Project commissions policies
CREATE POLICY "Production or admin can read project_commissions" ON public.project_commissions
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert project_commissions" ON public.project_commissions
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update project_commissions" ON public.project_commissions
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete project_commissions" ON public.project_commissions
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

-- Project checklists policies
CREATE POLICY "Production or admin can read project_checklists" ON public.project_checklists
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert project_checklists" ON public.project_checklists
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update project_checklists" ON public.project_checklists
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete project_checklists" ON public.project_checklists
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

-- Project messages policies
CREATE POLICY "Production or admin can read project_messages" ON public.project_messages
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert project_messages" ON public.project_messages
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update project_messages" ON public.project_messages
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete project_messages" ON public.project_messages
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

-- Project feedback policies
CREATE POLICY "Production or admin can read project_feedback" ON public.project_feedback
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert project_feedback" ON public.project_feedback
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update project_feedback" ON public.project_feedback
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete project_feedback" ON public.project_feedback
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

-- Project cases policies
CREATE POLICY "Production or admin can read project_cases" ON public.project_cases
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert project_cases" ON public.project_cases
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update project_cases" ON public.project_cases
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete project_cases" ON public.project_cases
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

-- Storage policies for project attachments
CREATE POLICY "Production or admin can upload project attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'project-attachments' AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production')));

CREATE POLICY "Production or admin can view project attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-attachments' AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production')));

CREATE POLICY "Production or admin can update project attachments" ON storage.objects
  FOR UPDATE USING (bucket_id = 'project-attachments' AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production')));

CREATE POLICY "Production or admin can delete project attachments" ON storage.objects
  FOR DELETE USING (bucket_id = 'project-attachments' AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production')));

-- Project documents policies
CREATE POLICY "Production or admin can read project_documents" ON public.project_documents
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert project_documents" ON public.project_documents
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update project_documents" ON public.project_documents
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete project_documents" ON public.project_documents
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

-- Audit logs policy
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Subcontractors policies
CREATE POLICY "Production or admin can read subcontractors" ON public.subcontractors
  FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can insert subcontractors" ON public.subcontractors
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update subcontractors" ON public.subcontractors
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can delete subcontractors" ON public.subcontractors
  FOR DELETE USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'production'));