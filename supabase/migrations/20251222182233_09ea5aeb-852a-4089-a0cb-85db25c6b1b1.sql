-- Add edit tracking fields to ghl_tasks
ALTER TABLE public.ghl_tasks 
ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;

-- Add edit tracking fields to contact_notes
ALTER TABLE public.contact_notes 
ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;

-- Add edit tracking fields to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;