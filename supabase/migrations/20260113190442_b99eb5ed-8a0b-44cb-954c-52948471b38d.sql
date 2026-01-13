-- Add payment scheduling columns to project_bills table
ALTER TABLE project_bills 
ADD COLUMN scheduled_payment_date DATE DEFAULT NULL,
ADD COLUMN scheduled_payment_amount NUMERIC DEFAULT NULL;