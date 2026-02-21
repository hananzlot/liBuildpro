ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;