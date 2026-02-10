
-- Table to store per-user analytics report visibility overrides
-- Role defaults: admin/super_admin see all; other roles see none by default (must be granted)
CREATE TABLE public.user_analytics_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  report_key TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id, report_key)
);

-- Index for fast lookups
CREATE INDEX idx_user_analytics_permissions_user_company 
  ON public.user_analytics_permissions(user_id, company_id);

-- Enable RLS
ALTER TABLE public.user_analytics_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own permissions
CREATE POLICY "Users can view own analytics permissions"
  ON public.user_analytics_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all permissions in their company
CREATE POLICY "Admins can view company analytics permissions"
  ON public.user_analytics_permissions
  FOR SELECT
  TO authenticated
  USING (
    public.has_company_access(company_id)
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
      )
    )
  );

-- Admins can insert/update/delete permissions for their company
CREATE POLICY "Admins can manage analytics permissions"
  ON public.user_analytics_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_company_access(company_id)
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
      )
    )
  );

CREATE POLICY "Admins can update analytics permissions"
  ON public.user_analytics_permissions
  FOR UPDATE
  TO authenticated
  USING (
    public.has_company_access(company_id)
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
      )
    )
  );

CREATE POLICY "Admins can delete analytics permissions"
  ON public.user_analytics_permissions
  FOR DELETE
  TO authenticated
  USING (
    public.has_company_access(company_id)
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
      )
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_user_analytics_permissions_updated_at
  BEFORE UPDATE ON public.user_analytics_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
