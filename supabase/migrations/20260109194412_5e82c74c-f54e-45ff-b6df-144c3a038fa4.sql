-- Create subcontractors table
CREATE TABLE public.subcontractors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  license_number TEXT,
  license_expiration_date DATE NOT NULL,
  license_document_url TEXT NOT NULL,
  insurance_expiration_date DATE NOT NULL,
  insurance_document_url TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Production or admin can read subcontractors"
ON public.subcontractors
FOR SELECT
USING (has_role(auth.uid(), 'production'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Production or admin can insert subcontractors"
ON public.subcontractors
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'production'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Production or admin can update subcontractors"
ON public.subcontractors
FOR UPDATE
USING (has_role(auth.uid(), 'production'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Production or admin can delete subcontractors"
ON public.subcontractors
FOR DELETE
USING (has_role(auth.uid(), 'production'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role subcontractors"
ON public.subcontractors
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_subcontractors_updated_at
BEFORE UPDATE ON public.subcontractors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();