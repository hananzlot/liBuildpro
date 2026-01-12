-- Add scope_of_work column to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS scope_of_work text;