ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS reference_url text;