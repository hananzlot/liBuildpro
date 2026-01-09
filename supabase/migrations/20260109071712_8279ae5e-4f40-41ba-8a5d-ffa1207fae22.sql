-- Create bill_payments table for multiple payments per bill
CREATE TABLE public.bill_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.project_bills(id) ON DELETE CASCADE,
  payment_date DATE,
  payment_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for bill_payments
CREATE POLICY "Allow all access to bill_payments" ON public.bill_payments FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_bill_payments_updated_at
BEFORE UPDATE ON public.bill_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();