-- Create opportunity_sales table for tracking sales per opportunity (up to 5)
CREATE TABLE public.opportunity_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  contact_id TEXT,
  location_id TEXT NOT NULL,
  sold_amount NUMERIC NOT NULL DEFAULT 0,
  sold_date DATE NOT NULL,
  sold_to_name TEXT,
  sold_to_phone TEXT,
  sold_by TEXT, -- ghl_user_id
  entered_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.opportunity_sales ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access on opportunity_sales"
ON public.opportunity_sales
FOR SELECT
USING (true);

CREATE POLICY "Allow authenticated insert on opportunity_sales"
ON public.opportunity_sales
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on opportunity_sales"
ON public.opportunity_sales
FOR UPDATE
USING (true);

CREATE POLICY "Allow authenticated delete on opportunity_sales"
ON public.opportunity_sales
FOR DELETE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_opportunity_sales_updated_at
BEFORE UPDATE ON public.opportunity_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();