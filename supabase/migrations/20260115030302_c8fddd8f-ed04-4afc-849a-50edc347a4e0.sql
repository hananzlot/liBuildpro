-- Drop the existing check constraint
ALTER TABLE public.document_signature_fields 
DROP CONSTRAINT document_signature_fields_field_type_check;

-- Add the new check constraint that includes 'text'
ALTER TABLE public.document_signature_fields 
ADD CONSTRAINT document_signature_fields_field_type_check 
CHECK (field_type = ANY (ARRAY['signature'::text, 'date'::text, 'name'::text, 'email'::text, 'text'::text]));