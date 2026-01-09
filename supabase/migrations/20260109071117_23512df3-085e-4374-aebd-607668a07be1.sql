-- Create payment phases table
CREATE TABLE public.project_payment_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  agreement_id UUID REFERENCES public.project_agreements(id) ON DELETE SET NULL,
  phase_name TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_payment_phases ENABLE ROW LEVEL SECURITY;

-- Create policies (matching existing project tables pattern)
CREATE POLICY "Allow all access to payment phases" ON public.project_payment_phases
  FOR ALL USING (true) WITH CHECK (true);

-- Add payment_phase_id to invoices
ALTER TABLE public.project_invoices 
ADD COLUMN IF NOT EXISTS payment_phase_id UUID REFERENCES public.project_payment_phases(id) ON DELETE SET NULL;

-- Add payment_phase_id to payments
ALTER TABLE public.project_payments 
ADD COLUMN IF NOT EXISTS payment_phase_id UUID REFERENCES public.project_payment_phases(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_project_payment_phases_updated_at
  BEFORE UPDATE ON public.project_payment_phases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();