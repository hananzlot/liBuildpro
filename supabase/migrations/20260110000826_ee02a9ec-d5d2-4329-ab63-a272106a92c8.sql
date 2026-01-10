-- Add columns to allow subcontractors without license/insurance requirements
ALTER TABLE public.subcontractors 
ADD COLUMN do_not_require_license boolean NOT NULL DEFAULT false,
ADD COLUMN do_not_require_insurance boolean NOT NULL DEFAULT false;

-- Update the columns to be nullable for license/insurance when toggles are true
-- Make the existing required columns nullable
ALTER TABLE public.subcontractors 
ALTER COLUMN license_expiration_date DROP NOT NULL,
ALTER COLUMN license_document_url DROP NOT NULL,
ALTER COLUMN insurance_expiration_date DROP NOT NULL,
ALTER COLUMN insurance_document_url DROP NOT NULL;