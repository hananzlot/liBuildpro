-- Add address column to opportunities table
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS address text;