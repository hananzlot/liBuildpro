ALTER TABLE public.quickbooks_sync_log 
  ADD COLUMN IF NOT EXISTS dismissed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;