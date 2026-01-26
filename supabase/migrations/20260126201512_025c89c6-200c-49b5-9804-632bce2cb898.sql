-- Allow admin users to delete tasks within their company
CREATE POLICY "Admins can delete tasks"
ON public.ghl_tasks
FOR DELETE
TO authenticated
USING (
  public.has_company_access(company_id)
  AND public.is_admin(auth.uid())
);