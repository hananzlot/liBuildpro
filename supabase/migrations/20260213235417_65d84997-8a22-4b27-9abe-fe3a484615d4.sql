
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS estimate_mode text DEFAULT 'ai';
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS manual_total numeric DEFAULT 0;
