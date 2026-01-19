-- Add column to control scope of work visibility on proposals/contracts
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS show_scope_to_customer boolean NOT NULL DEFAULT false;