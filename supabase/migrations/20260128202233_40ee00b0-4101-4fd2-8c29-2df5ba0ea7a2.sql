-- Create table to track GHL records that should be excluded from sync
CREATE TABLE public.ghl_sync_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_id TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('opportunity', 'contact', 'appointment')),
  location_id TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  excluded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  excluded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  UNIQUE (ghl_id, record_type, location_id)
);

-- Enable RLS
ALTER TABLE public.ghl_sync_exclusions ENABLE ROW LEVEL SECURITY;

-- Admins can manage exclusions for their company
CREATE POLICY "Admins can manage sync exclusions"
ON public.ghl_sync_exclusions
FOR ALL
USING (public.has_company_access(company_id))
WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- Create index for fast lookups during sync
CREATE INDEX idx_ghl_sync_exclusions_lookup 
ON public.ghl_sync_exclusions(ghl_id, record_type, location_id);