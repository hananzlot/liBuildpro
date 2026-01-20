-- Create table for GHL custom field mappings
CREATE TABLE public.ghl_field_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  field_name TEXT NOT NULL,
  ghl_custom_field_id TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, field_name)
);

-- Enable RLS
ALTER TABLE public.ghl_field_mappings ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can view field mappings" 
ON public.ghl_field_mappings 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can manage field mappings" 
ON public.ghl_field_mappings 
FOR ALL 
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_ghl_field_mappings_updated_at
BEFORE UPDATE ON public.ghl_field_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Prepopulate with existing hardcoded values (company_id NULL = global defaults)
INSERT INTO public.ghl_field_mappings (company_id, field_name, ghl_custom_field_id, description) VALUES
(NULL, 'address', 'b7oTVsUQrLgZt84bHpCn', 'Contact address custom field'),
(NULL, 'scope_of_work', 'KwQRtJT0aMSHnq3mwR68', 'Scope of work custom field'),
(NULL, 'notes', '588ddQgiGEg3AWtTQB2i', 'Additional notes custom field');