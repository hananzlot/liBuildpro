-- Create magazine_sales table
CREATE TABLE public.magazine_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT,
  buyer_email TEXT,
  company_name TEXT,
  magazine_issue_date DATE NOT NULL,
  ad_sold TEXT NOT NULL,
  page_size TEXT NOT NULL,
  page_number TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  entered_by UUID REFERENCES public.profiles(id)
);

-- Create magazine_sales_edits table for audit trail
CREATE TABLE public.magazine_sales_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  magazine_sale_id UUID NOT NULL REFERENCES public.magazine_sales(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edited_by UUID REFERENCES public.profiles(id),
  edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.magazine_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magazine_sales_edits ENABLE ROW LEVEL SECURITY;

-- RLS policies for magazine_sales
CREATE POLICY "Allow authenticated read access on magazine_sales"
ON public.magazine_sales FOR SELECT
USING (true);

CREATE POLICY "Allow authenticated insert on magazine_sales"
ON public.magazine_sales FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on magazine_sales"
ON public.magazine_sales FOR UPDATE
USING (true);

CREATE POLICY "Allow authenticated delete on magazine_sales"
ON public.magazine_sales FOR DELETE
USING (true);

-- RLS policies for magazine_sales_edits
CREATE POLICY "Allow authenticated read access on magazine_sales_edits"
ON public.magazine_sales_edits FOR SELECT
USING (true);

CREATE POLICY "Allow authenticated insert on magazine_sales_edits"
ON public.magazine_sales_edits FOR INSERT
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_magazine_sales_updated_at
BEFORE UPDATE ON public.magazine_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_magazine_sales_issue_date ON public.magazine_sales(magazine_issue_date);
CREATE INDEX idx_magazine_sales_edits_sale_id ON public.magazine_sales_edits(magazine_sale_id);