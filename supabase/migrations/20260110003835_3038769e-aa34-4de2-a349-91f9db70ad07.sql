-- Add bank_name column to commission_payments table
ALTER TABLE public.commission_payments 
ADD COLUMN bank_name text;