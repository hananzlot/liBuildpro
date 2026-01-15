-- Create salespeople table to manage salesperson contact info
CREATE TABLE public.salespeople (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.salespeople ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Authenticated users can view salespeople"
ON public.salespeople
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage
CREATE POLICY "Admins can insert salespeople"
ON public.salespeople
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update salespeople"
ON public.salespeople
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admins can delete salespeople"
ON public.salespeople
FOR DELETE
TO authenticated
USING (true);

-- Allow portal access (anonymous read for portal)
CREATE POLICY "Portal can view salespeople"
ON public.salespeople
FOR SELECT
TO anon
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_salespeople_updated_at
BEFORE UPDATE ON public.salespeople
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();