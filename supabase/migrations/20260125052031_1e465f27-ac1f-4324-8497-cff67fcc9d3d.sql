-- URL Shortener Tables (ADDITIVE ONLY - no changes to existing tables)

-- Create short_links table
CREATE TABLE public.short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by_type text NOT NULL CHECK (created_by_type IN ('internal_user', 'customer', 'salesperson')),
  created_by_id uuid NOT NULL,
  long_url text NOT NULL,
  short_code text NOT NULL,
  custom_alias text,
  title text,
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  max_clicks integer,
  click_count bigint DEFAULT 0,
  last_clicked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT short_links_short_code_key UNIQUE (short_code),
  CONSTRAINT short_links_custom_alias_key UNIQUE (custom_alias),
  CONSTRAINT short_links_long_url_check CHECK (long_url ~* '^https?://'),
  CONSTRAINT short_links_long_url_length CHECK (length(long_url) <= 2048),
  CONSTRAINT short_links_custom_alias_format CHECK (custom_alias IS NULL OR custom_alias ~* '^[a-zA-Z0-9_-]{3,40}$')
);

-- Indexes for short_links
CREATE INDEX idx_short_links_company_id ON public.short_links(company_id);
CREATE INDEX idx_short_links_created_by ON public.short_links(created_by_type, created_by_id);
CREATE INDEX idx_short_links_created_at ON public.short_links(created_at DESC);
CREATE INDEX idx_short_links_lookup ON public.short_links(short_code) WHERE is_active = true;
CREATE INDEX idx_short_links_alias_lookup ON public.short_links(custom_alias) WHERE custom_alias IS NOT NULL AND is_active = true;

-- Create short_link_clicks table
CREATE TABLE public.short_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id uuid NOT NULL REFERENCES public.short_links(id) ON DELETE CASCADE,
  clicked_at timestamptz DEFAULT now(),
  ip_hash text,
  user_agent text,
  referer text,
  country text,
  device_type text
);

-- Index for short_link_clicks
CREATE INDEX idx_short_link_clicks_link_time ON public.short_link_clicks(short_link_id, clicked_at DESC);

-- Updated_at trigger for short_links (reuses existing function)
CREATE TRIGGER update_short_links_updated_at
  BEFORE UPDATE ON public.short_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_link_clicks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for short_links (internal authenticated users only)
CREATE POLICY "Internal users view company short_links"
  ON public.short_links FOR SELECT
  TO authenticated
  USING (public.has_company_access(company_id));

CREATE POLICY "Internal users insert company short_links"
  ON public.short_links FOR INSERT
  TO authenticated
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Internal users update company short_links"
  ON public.short_links FOR UPDATE
  TO authenticated
  USING (public.has_company_access(company_id));

CREATE POLICY "Internal users delete company short_links"
  ON public.short_links FOR DELETE
  TO authenticated
  USING (public.has_company_access(company_id));

-- RLS Policies for short_link_clicks
CREATE POLICY "Internal users view company short_link_clicks"
  ON public.short_link_clicks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.short_links sl 
      WHERE sl.id = short_link_clicks.short_link_id 
      AND public.has_company_access(sl.company_id)
    )
  );

-- Super admin full access policies
CREATE POLICY "Super admins full access to short_links"
  ON public.short_links FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins full access to short_link_clicks"
  ON public.short_link_clicks FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));