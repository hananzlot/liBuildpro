-- Add DELETE policy for estimate_generation_jobs table
CREATE POLICY "Users can delete jobs in their company" 
ON public.estimate_generation_jobs 
FOR DELETE 
USING (has_company_access(company_id));