-- Add RLS policy for salesperson portal to insert project documents
CREATE POLICY "Salesperson portal can insert project documents"
ON public.project_documents
FOR INSERT
TO public
WITH CHECK (
  public.salesperson_portal_can_upload_to_project(project_id)
);