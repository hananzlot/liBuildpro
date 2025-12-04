-- Create contact_notes table for GHL notes
CREATE TABLE public.contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  body TEXT,
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ghl_date_added TIMESTAMP WITH TIME ZONE,
  location_id TEXT NOT NULL,
  UNIQUE(ghl_id)
);

-- Enable RLS
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access" 
ON public.contact_notes 
FOR SELECT 
USING (true);

CREATE POLICY "Allow service role full access" 
ON public.contact_notes 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_contact_notes_updated_at
BEFORE UPDATE ON public.contact_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for contact lookups
CREATE INDEX idx_contact_notes_contact_id ON public.contact_notes(contact_id);