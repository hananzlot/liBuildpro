-- Add subcontractor type column
ALTER TABLE public.subcontractors 
ADD COLUMN subcontractor_type text NOT NULL DEFAULT 'Subcontractor';

-- Add a comment for clarity
COMMENT ON COLUMN public.subcontractors.subcontractor_type IS 'Type of subcontractor: Subcontractor, Material/Equipment, or Other';