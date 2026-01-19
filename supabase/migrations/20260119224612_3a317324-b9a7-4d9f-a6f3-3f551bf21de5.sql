-- Add salesperson_name column to estimates table
ALTER TABLE public.estimates 
ADD COLUMN salesperson_name TEXT;