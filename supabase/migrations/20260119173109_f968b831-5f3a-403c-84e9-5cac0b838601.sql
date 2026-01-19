-- Add show_details_to_customer column to estimates table
ALTER TABLE public.estimates 
ADD COLUMN show_details_to_customer boolean NOT NULL DEFAULT true;