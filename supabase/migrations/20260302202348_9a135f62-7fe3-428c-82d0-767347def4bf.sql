
-- Junction table: users can belong to multiple companies
CREATE TABLE public.user_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, company_id)
);

-- Enable RLS
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- Super admins can see all
CREATE POLICY "Super admins can manage all user_companies"
  ON public.user_companies
  FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- Corp admins can manage user_companies within their corporation
CREATE POLICY "Corp admins can manage user_companies in their corporation"
  ON public.user_companies
  FOR ALL
  USING (
    public.is_corp_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.companies c1
      JOIN public.companies c2 ON c1.corporation_id = c2.corporation_id
      WHERE c1.id = user_companies.company_id
        AND c2.id = public.get_user_company_id()
    )
  );

-- Users can see their own associations
CREATE POLICY "Users can view their own company associations"
  ON public.user_companies
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view associations for users in their company
CREATE POLICY "Admins can view user_companies in their company"
  ON public.user_companies
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
    AND public.has_company_access(company_id)
  );

-- Index for fast lookups
CREATE INDEX idx_user_companies_user_id ON public.user_companies(user_id);
CREATE INDEX idx_user_companies_company_id ON public.user_companies(company_id);

-- Update has_company_access to also check user_companies table
CREATE OR REPLACE FUNCTION public.has_company_access(target_company_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT 
    -- Super admins can access any company
    public.is_super_admin(auth.uid())
    OR
    -- Direct company access (primary company from profile)
    target_company_id = public.get_user_company_id()
    OR
    -- Multi-company access via user_companies junction table
    EXISTS (
      SELECT 1 FROM public.user_companies
      WHERE user_id = auth.uid()
        AND company_id = target_company_id
    )
    OR
    -- Corp admin can access all companies in their corporation
    (
      public.is_corp_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.companies c1
        JOIN public.companies c2 ON c1.corporation_id = c2.corporation_id
        WHERE c1.id = target_company_id
        AND c2.id = public.get_user_company_id()
      )
    )
$$;

-- Seed existing profile company_id into user_companies for all users
INSERT INTO public.user_companies (user_id, company_id, is_primary)
SELECT id, company_id, true
FROM public.profiles
WHERE company_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;
