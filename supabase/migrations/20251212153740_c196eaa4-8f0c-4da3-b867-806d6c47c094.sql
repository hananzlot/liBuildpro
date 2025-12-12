-- Create opportunity_edits table for tracking field changes
CREATE TABLE public.opportunity_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_ghl_id text NOT NULL,
  contact_ghl_id text,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  edited_by uuid REFERENCES public.profiles(id),
  edited_at timestamptz DEFAULT now(),
  location_id text
);

-- Enable RLS
ALTER TABLE public.opportunity_edits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow authenticated read access on opportunity_edits"
ON public.opportunity_edits
FOR SELECT
USING (true);

CREATE POLICY "Allow service role full access on opportunity_edits"
ON public.opportunity_edits
FOR ALL
USING (true)
WITH CHECK (true);

-- Indexes for efficient queries
CREATE INDEX idx_opportunity_edits_ghl_id ON public.opportunity_edits(opportunity_ghl_id);
CREATE INDEX idx_opportunity_edits_edited_at ON public.opportunity_edits(edited_at);
CREATE INDEX idx_opportunity_edits_contact_ghl_id ON public.opportunity_edits(contact_ghl_id);