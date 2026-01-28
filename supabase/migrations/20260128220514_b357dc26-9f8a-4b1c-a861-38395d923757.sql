-- Create table to store field overlay positions for compliance templates
CREATE TABLE public.compliance_template_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.compliance_document_templates(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  field_key TEXT NOT NULL, -- e.g., 'customer_name', 'estimate_total', 'current_date'
  field_label TEXT, -- Display label for the field
  page_number INTEGER NOT NULL DEFAULT 1,
  x_position NUMERIC NOT NULL, -- X coordinate on the page (in points, 72 points = 1 inch)
  y_position NUMERIC NOT NULL, -- Y coordinate on the page (in points, from bottom-left)
  width NUMERIC DEFAULT 200, -- Width of the text box
  font_size NUMERIC NOT NULL DEFAULT 12,
  font_color TEXT DEFAULT '#000000',
  text_align TEXT DEFAULT 'left', -- left, center, right
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compliance_template_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company's template fields"
  ON public.compliance_template_fields
  FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can insert template fields for their company"
  ON public.compliance_template_fields
  FOR INSERT
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Users can update their company's template fields"
  ON public.compliance_template_fields
  FOR UPDATE
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can delete their company's template fields"
  ON public.compliance_template_fields
  FOR DELETE
  USING (public.has_company_access(company_id));

-- Index for faster lookups
CREATE INDEX idx_compliance_template_fields_template_id ON public.compliance_template_fields(template_id);

-- Trigger for updated_at
CREATE TRIGGER update_compliance_template_fields_updated_at
  BEFORE UPDATE ON public.compliance_template_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();