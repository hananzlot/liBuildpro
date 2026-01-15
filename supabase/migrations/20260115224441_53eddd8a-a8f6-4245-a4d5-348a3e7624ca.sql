-- Add work_scope_description column to estimates table
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS work_scope_description TEXT;