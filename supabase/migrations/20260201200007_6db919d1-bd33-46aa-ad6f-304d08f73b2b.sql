-- Allow salesperson portal token-holders to read project_documents
-- for projects they can access via their salesperson token.
CREATE POLICY "Salesperson portal can read project_documents"
ON public.project_documents
FOR SELECT
USING (
  company_id IS NOT NULL
  AND public.has_valid_salesperson_portal_token(company_id)
  AND public.salesperson_portal_can_upload_to_project(project_id)
);

-- Allow salesperson portal token-holders to insert project_documents
-- for projects they can upload to via their salesperson token.
CREATE POLICY "Salesperson portal can insert project_documents"
ON public.project_documents
FOR INSERT
WITH CHECK (
  company_id IS NOT NULL
  AND public.has_valid_salesperson_portal_token(company_id)
  AND public.salesperson_portal_can_upload_to_project(project_id)
);