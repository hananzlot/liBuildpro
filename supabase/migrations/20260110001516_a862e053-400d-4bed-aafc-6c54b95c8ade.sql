-- Add trade field for subcontractors
ALTER TABLE public.subcontractors
ADD COLUMN trade text NULL;