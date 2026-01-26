-- Add INSERT policy for appointment_edits so users can log their edits
CREATE POLICY "Users can insert appointment edits for their company"
ON public.appointment_edits
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (company_id IS NULL OR has_company_access(company_id))
);

-- Also add UPDATE policy in case it's needed
CREATE POLICY "Users can update appointment edits in their company"
ON public.appointment_edits
FOR UPDATE
USING (has_company_access(company_id))
WITH CHECK (has_company_access(company_id));