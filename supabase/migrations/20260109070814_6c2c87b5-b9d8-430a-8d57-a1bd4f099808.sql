-- Add payment method and payment reference fields to project_bills
ALTER TABLE public.project_bills 
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS payment_reference text;