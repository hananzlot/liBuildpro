-- Add required and label columns to document_signature_fields
ALTER TABLE public.document_signature_fields 
ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS field_label text;