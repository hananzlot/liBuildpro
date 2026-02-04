-- Create a security definer function to check if there's a valid salesperson portal token for a company
CREATE OR REPLACE FUNCTION public.has_valid_salesperson_portal_token_for_company(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.salesperson_portal_tokens spt
    WHERE spt.company_id = target_company_id
      AND spt.is_active = true
      AND (spt.expires_at IS NULL OR spt.expires_at > now())
  )
$$;

-- Add RLS policy to allow salesperson portal token holders to insert projects
CREATE POLICY "Salesperson portal can create projects"
ON public.projects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.has_valid_salesperson_portal_token_for_company(company_id)
);

-- Add RLS policy to allow salesperson portal to update projects they can access
CREATE POLICY "Salesperson portal can update accessible projects"
ON public.projects
FOR UPDATE
TO anon, authenticated
USING (
  public.salesperson_portal_can_upload_to_project(id)
)
WITH CHECK (
  public.salesperson_portal_can_upload_to_project(id)
);