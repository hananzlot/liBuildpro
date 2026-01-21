-- Add deposit_max_amount column to estimates table
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS deposit_max_amount NUMERIC DEFAULT 1000;