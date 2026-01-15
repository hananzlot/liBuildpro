-- Add cancellation fields to signature_documents
ALTER TABLE public.signature_documents 
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancellation_reason text;