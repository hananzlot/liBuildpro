-- Create table for signature field templates
CREATE TABLE public.signature_field_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for template fields (the actual field positions)
CREATE TABLE public.signature_field_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.signature_field_templates(id) ON DELETE CASCADE,
  signer_order INTEGER NOT NULL DEFAULT 1,
  page_number INTEGER NOT NULL DEFAULT 1,
  x_position NUMERIC NOT NULL,
  y_position NUMERIC NOT NULL,
  width NUMERIC NOT NULL DEFAULT 200,
  height NUMERIC NOT NULL DEFAULT 50,
  field_type TEXT NOT NULL DEFAULT 'signature',
  is_required BOOLEAN NOT NULL DEFAULT true,
  field_label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signature_field_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_field_template_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for templates
CREATE POLICY "Authenticated users can view templates"
ON public.signature_field_templates
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create templates"
ON public.signature_field_templates
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own templates"
ON public.signature_field_templates
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own templates"
ON public.signature_field_templates
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- RLS policies for template items
CREATE POLICY "Authenticated users can view template items"
ON public.signature_field_template_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage template items"
ON public.signature_field_template_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.signature_field_templates t
    WHERE t.id = template_id
  )
);

-- Create indexes
CREATE INDEX idx_template_items_template_id ON public.signature_field_template_items(template_id);
CREATE INDEX idx_templates_created_by ON public.signature_field_templates(created_by);