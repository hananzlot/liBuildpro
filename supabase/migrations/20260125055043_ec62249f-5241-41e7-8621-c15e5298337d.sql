-- Add salesperson_id column to google_calendar_connections table
ALTER TABLE public.google_calendar_connections 
ADD COLUMN salesperson_id uuid REFERENCES public.salespeople(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX idx_google_calendar_connections_salesperson_id 
ON public.google_calendar_connections(salesperson_id);

-- Backfill existing connections where we can match via user_id -> profiles -> salespeople
-- This links personal calendars to their corresponding salesperson records
UPDATE public.google_calendar_connections gcc
SET salesperson_id = s.id
FROM public.profiles p
JOIN public.salespeople s ON s.ghl_user_id = p.ghl_user_id AND s.is_active = true
WHERE gcc.user_id = p.id
  AND gcc.is_company_calendar = false
  AND gcc.salesperson_id IS NULL
  AND p.ghl_user_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.google_calendar_connections.salesperson_id IS 'Links personal calendars to salespeople for filtering and assignment';