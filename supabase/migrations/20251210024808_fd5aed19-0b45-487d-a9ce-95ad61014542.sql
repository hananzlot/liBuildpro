-- Add address column to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS address TEXT;