-- Add ghl_id column to tasks table for GHL sync reference
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS ghl_id text;