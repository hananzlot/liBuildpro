-- Add salesperson_confirmation_status column to appointments
-- Values: 'unconfirmed', 'confirmed', 'rescheduled'
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS salesperson_confirmation_status TEXT DEFAULT 'unconfirmed';

-- Migrate existing data: if salesperson_confirmed is true, set status to 'confirmed'
UPDATE public.appointments 
SET salesperson_confirmation_status = CASE 
  WHEN salesperson_confirmed = true THEN 'confirmed'
  ELSE 'unconfirmed'
END
WHERE salesperson_confirmation_status IS NULL OR salesperson_confirmation_status = 'unconfirmed';

-- Add a comment for documentation
COMMENT ON COLUMN public.appointments.salesperson_confirmation_status IS 'Salesperson confirmation status: unconfirmed, confirmed, or rescheduled';