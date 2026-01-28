-- Add static_text column to compliance_template_fields for storing user-typed text overlays
ALTER TABLE public.compliance_template_fields
ADD COLUMN IF NOT EXISTS static_text text;