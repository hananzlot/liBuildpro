-- Add bank_name column to bill_payments table
ALTER TABLE public.bill_payments
ADD COLUMN bank_name text;