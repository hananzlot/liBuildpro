
-- Add salesperson_id column to appointments
ALTER TABLE public.appointments
ADD COLUMN salesperson_id uuid REFERENCES public.salespeople(id) ON DELETE SET NULL;

-- Add salesperson_id column to opportunities
ALTER TABLE public.opportunities
ADD COLUMN salesperson_id uuid REFERENCES public.salespeople(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_appointments_salesperson_id ON public.appointments(salesperson_id);
CREATE INDEX idx_opportunities_salesperson_id ON public.opportunities(salesperson_id);

-- Backfill appointments from GHL user ID mappings
UPDATE public.appointments a
SET salesperson_id = s.id
FROM public.salespeople s
WHERE a.assigned_user_id = s.ghl_user_id
  AND a.company_id = s.company_id
  AND s.is_active = true
  AND a.salesperson_id IS NULL;

-- Backfill opportunities from GHL user ID mappings
UPDATE public.opportunities o
SET salesperson_id = s.id
FROM public.salespeople s
WHERE o.assigned_to = s.ghl_user_id
  AND o.company_id = s.company_id
  AND s.is_active = true
  AND o.salesperson_id IS NULL;