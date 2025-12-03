-- Create contacts table to store GHL contact data
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ghl_id TEXT NOT NULL UNIQUE,
  location_id TEXT NOT NULL,
  contact_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,
  tags TEXT[],
  assigned_to TEXT,
  ghl_date_added TIMESTAMP WITH TIME ZONE,
  ghl_date_updated TIMESTAMP WITH TIME ZONE,
  custom_fields JSONB,
  attributions JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_contacts_ghl_id ON public.contacts(ghl_id);
CREATE INDEX idx_contacts_source ON public.contacts(source);
CREATE INDEX idx_contacts_assigned_to ON public.contacts(assigned_to);
CREATE INDEX idx_contacts_ghl_date_added ON public.contacts(ghl_date_added);
CREATE INDEX idx_contacts_location_id ON public.contacts(location_id);

-- Enable RLS (public read for now since no auth)
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Allow public read access (dashboard is public)
CREATE POLICY "Allow public read access" ON public.contacts
  FOR SELECT USING (true);

-- Allow service role to insert/update (edge function uses service role)
CREATE POLICY "Allow service role full access" ON public.contacts
  FOR ALL USING (true) WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();