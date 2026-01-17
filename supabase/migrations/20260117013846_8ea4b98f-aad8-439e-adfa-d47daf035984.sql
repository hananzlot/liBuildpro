-- Drop the old constraint and add new one with 'initials' included
ALTER TABLE public.document_signature_fields 
DROP CONSTRAINT document_signature_fields_field_type_check;

ALTER TABLE public.document_signature_fields 
ADD CONSTRAINT document_signature_fields_field_type_check 
CHECK (field_type = ANY (ARRAY['signature'::text, 'initials'::text, 'date'::text, 'name'::text, 'email'::text, 'text'::text]));