-- Allow admin and dispatch roles to update appointments in their company
CREATE POLICY "Dispatch and admin can update appointments"
ON public.appointments
FOR UPDATE
USING (
  has_company_access(company_id)
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'dispatch'::app_role)
  )
)
WITH CHECK (
  has_company_access(company_id)
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'dispatch'::app_role)
  )
);