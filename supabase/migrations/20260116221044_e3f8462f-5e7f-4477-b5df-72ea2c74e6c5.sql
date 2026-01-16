-- Add field_values column to store text field inputs and other field data
ALTER TABLE public.document_signatures 
ADD COLUMN IF NOT EXISTS field_values JSONB DEFAULT '{}'::jsonb;