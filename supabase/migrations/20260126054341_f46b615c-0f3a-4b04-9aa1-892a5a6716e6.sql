-- Create archived_sources table to track sources that should be hidden from selection
CREATE TABLE public.archived_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on company_id + source_name to prevent duplicates
CREATE UNIQUE INDEX idx_archived_sources_company_source ON public.archived_sources(company_id, LOWER(source_name));

-- Enable RLS
ALTER TABLE public.archived_sources ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view archived sources for their company"
  ON public.archived_sources FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Admins can insert archived sources for their company"
  ON public.archived_sources FOR INSERT
  WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete archived sources for their company"
  ON public.archived_sources FOR DELETE
  USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()));