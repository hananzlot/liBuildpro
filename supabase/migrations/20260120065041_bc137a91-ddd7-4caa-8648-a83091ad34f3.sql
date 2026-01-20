-- =====================================================
-- FIX: Cross-company data leakage on bills/invoices/signature_documents
-- =====================================================

-- ========================
-- project_bills: Remove role-only policies (no company_id check)
-- ========================
DROP POLICY IF EXISTS "Production or admin can read project_bills" ON public.project_bills;
DROP POLICY IF EXISTS "Production or admin can insert project_bills" ON public.project_bills;
DROP POLICY IF EXISTS "Production or admin can update project_bills" ON public.project_bills;
DROP POLICY IF EXISTS "Production or admin can delete project_bills" ON public.project_bills;
DROP POLICY IF EXISTS "Service role project_bills" ON public.project_bills;

-- ========================
-- project_invoices: Remove role-only policies (no company_id check)
-- ========================
DROP POLICY IF EXISTS "Production or admin can read project_invoices" ON public.project_invoices;
DROP POLICY IF EXISTS "Production or admin can insert project_invoices" ON public.project_invoices;
DROP POLICY IF EXISTS "Production or admin can update project_invoices" ON public.project_invoices;
DROP POLICY IF EXISTS "Production or admin can delete project_invoices" ON public.project_invoices;
DROP POLICY IF EXISTS "Service role project_invoices" ON public.project_invoices;

-- ========================
-- signature_documents: Remove overly permissive policies
-- ========================
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.signature_documents;
DROP POLICY IF EXISTS "Authenticated users can create documents" ON public.signature_documents;
DROP POLICY IF EXISTS "Admins can do everything with documents" ON public.signature_documents;

-- ========================
-- document_signers: Remove public true policies, keep portal token access
-- ========================
DROP POLICY IF EXISTS "Anyone can view document signers" ON public.document_signers;
DROP POLICY IF EXISTS "Authenticated users can create document signers" ON public.document_signers;
DROP POLICY IF EXISTS "Authenticated users can update document signers" ON public.document_signers;
DROP POLICY IF EXISTS "Authenticated users can delete document signers" ON public.document_signers;

-- ========================
-- document_signature_fields: Remove public true policies
-- ========================
DROP POLICY IF EXISTS "Anyone can view signature fields" ON public.document_signature_fields;
DROP POLICY IF EXISTS "Authenticated users can create signature fields" ON public.document_signature_fields;
DROP POLICY IF EXISTS "Authenticated users can update signature fields" ON public.document_signature_fields;
DROP POLICY IF EXISTS "Authenticated users can delete signature fields" ON public.document_signature_fields;

-- ========================
-- Re-create proper company-scoped policies for document_signers
-- ========================
CREATE POLICY "Company users can view document signers"
ON public.document_signers FOR SELECT
TO authenticated
USING (has_company_access(company_id));

CREATE POLICY "Company users can insert document signers"
ON public.document_signers FOR INSERT
TO authenticated
WITH CHECK (has_company_access(company_id));

CREATE POLICY "Company users can update document signers"
ON public.document_signers FOR UPDATE
TO authenticated
USING (has_company_access(company_id));

CREATE POLICY "Company users can delete document signers"
ON public.document_signers FOR DELETE
TO authenticated
USING (has_company_access(company_id));

-- ========================
-- Re-create proper company-scoped policies for document_signature_fields
-- ========================
CREATE POLICY "Company users can view signature fields"
ON public.document_signature_fields FOR SELECT
TO authenticated
USING (has_company_access(company_id));

CREATE POLICY "Company users can insert signature fields"
ON public.document_signature_fields FOR INSERT
TO authenticated
WITH CHECK (has_company_access(company_id));

CREATE POLICY "Company users can update signature fields"
ON public.document_signature_fields FOR UPDATE
TO authenticated
USING (has_company_access(company_id));

CREATE POLICY "Company users can delete signature fields"
ON public.document_signature_fields FOR DELETE
TO authenticated
USING (has_company_access(company_id));