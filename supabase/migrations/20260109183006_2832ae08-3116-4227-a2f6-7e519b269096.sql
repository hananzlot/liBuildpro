-- Create commission_payments table to track individual commission payments to salespeople
CREATE TABLE public.commission_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  salesperson_name TEXT NOT NULL,
  payment_date DATE,
  payment_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view commission payments"
ON public.commission_payments
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert commission payments"
ON public.commission_payments
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update commission payments"
ON public.commission_payments
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete commission payments"
ON public.commission_payments
FOR DELETE
USING (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX idx_commission_payments_project_id ON public.commission_payments(project_id);
CREATE INDEX idx_commission_payments_salesperson ON public.commission_payments(salesperson_name);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_commission_payments_updated_at
BEFORE UPDATE ON public.commission_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();