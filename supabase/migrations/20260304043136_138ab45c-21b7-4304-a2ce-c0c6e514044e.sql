CREATE POLICY "Admins can delete signed compliance docs"
ON public.signed_compliance_documents
FOR DELETE
TO authenticated
USING (has_company_access(company_id) AND is_admin(auth.uid()));