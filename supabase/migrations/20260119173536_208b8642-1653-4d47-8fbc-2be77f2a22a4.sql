-- Change default value for show_details_to_customer to false
ALTER TABLE public.estimates 
ALTER COLUMN show_details_to_customer SET DEFAULT false;