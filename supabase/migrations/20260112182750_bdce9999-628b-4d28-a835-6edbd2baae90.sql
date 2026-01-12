-- Add project_scope_dispatch column to projects table for storing scope from dispatch
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_scope_dispatch text;

-- Add sold_dispatch_value column to store the original sold value from dispatch/opportunity
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS sold_dispatch_value numeric;

-- Update the existing project that was just created with the missing values
UPDATE public.projects 
SET 
  sold_dispatch_value = 150000,
  estimated_cost = 150000
WHERE opportunity_id = 'ugvtKsCv2DlZRe790szN';