-- Add salesperson_confirmed column to appointments table
ALTER TABLE public.appointments 
ADD COLUMN salesperson_confirmed boolean NOT NULL DEFAULT false;

-- Add salesperson_confirmed_at to track when it was confirmed
ALTER TABLE public.appointments 
ADD COLUMN salesperson_confirmed_at timestamp with time zone;