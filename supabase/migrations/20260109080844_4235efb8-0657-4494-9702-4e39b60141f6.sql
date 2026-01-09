-- Add a single project-level commission split percentage
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS commission_split_pct numeric DEFAULT 50;