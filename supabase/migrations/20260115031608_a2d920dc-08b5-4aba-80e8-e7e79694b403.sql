-- Drop the existing status check constraint
ALTER TABLE public.signature_documents 
DROP CONSTRAINT signature_documents_status_check;

-- Add the new check constraint that includes 'cancelled'
ALTER TABLE public.signature_documents 
ADD CONSTRAINT signature_documents_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'viewed'::text, 'signed'::text, 'declined'::text, 'cancelled'::text]));