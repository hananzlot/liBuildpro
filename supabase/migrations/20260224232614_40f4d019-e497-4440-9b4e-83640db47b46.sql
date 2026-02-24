
-- Table to store dismissed duplicate pairs so they don't appear again
CREATE TABLE public.dismissed_duplicate_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id_a UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  contact_id_b UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  dismissed_by UUID REFERENCES public.profiles(id),
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_dismissed_pair UNIQUE (company_id, contact_id_a, contact_id_b),
  CONSTRAINT different_contacts CHECK (contact_id_a <> contact_id_b)
);

-- Index for fast lookups
CREATE INDEX idx_dismissed_duplicates_company ON public.dismissed_duplicate_contacts(company_id);
CREATE INDEX idx_dismissed_duplicates_contacts ON public.dismissed_duplicate_contacts(contact_id_a, contact_id_b);

-- Enable RLS
ALTER TABLE public.dismissed_duplicate_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view dismissed duplicates in their company"
  ON public.dismissed_duplicate_contacts FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can insert dismissed duplicates in their company"
  ON public.dismissed_duplicate_contacts FOR INSERT
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Users can delete dismissed duplicates in their company"
  ON public.dismissed_duplicate_contacts FOR DELETE
  USING (public.has_company_access(company_id));
