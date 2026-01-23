-- Allow contract_manager role to create/manage projects (needed for sending proposals)
CREATE POLICY "Contract managers manage projects in their company"
ON public.projects
FOR ALL
USING (has_company_access(company_id) AND has_role(auth.uid(), 'contract_manager'))
WITH CHECK (has_company_access(company_id) AND has_role(auth.uid(), 'contract_manager'));

-- Also allow sales role to create projects (for estimate workflow)
CREATE POLICY "Sales can create projects in their company"
ON public.projects
FOR INSERT
WITH CHECK (has_company_access(company_id) AND has_role(auth.uid(), 'sales'));