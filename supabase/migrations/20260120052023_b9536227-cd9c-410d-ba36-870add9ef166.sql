-- Add integration_id column
ALTER TABLE public.ghl_field_mappings 
  ADD COLUMN integration_id UUID;

-- Add foreign key constraint
ALTER TABLE public.ghl_field_mappings 
  ADD CONSTRAINT ghl_field_mappings_integration_id_fkey 
  FOREIGN KEY (integration_id) REFERENCES public.company_integrations(id) ON DELETE CASCADE;

-- Drop the old unique constraint
ALTER TABLE public.ghl_field_mappings
  DROP CONSTRAINT IF EXISTS ghl_field_mappings_company_id_field_name_key;

-- Add new unique constraint per integration
ALTER TABLE public.ghl_field_mappings
  ADD CONSTRAINT ghl_field_mappings_unique_per_integration 
  UNIQUE (field_name, integration_id);

-- Migrate existing global mappings to each active GHL integration
INSERT INTO public.ghl_field_mappings (field_name, ghl_custom_field_id, description, integration_id, company_id)
SELECT 
  gfm.field_name,
  gfm.ghl_custom_field_id,
  gfm.description,
  ci.id as integration_id,
  ci.company_id
FROM public.ghl_field_mappings gfm
CROSS JOIN public.company_integrations ci
WHERE gfm.integration_id IS NULL
  AND ci.provider = 'ghl'
  AND ci.is_active = true
ON CONFLICT (field_name, integration_id) DO NOTHING;

-- Delete the old global mappings (those without integration_id)
DELETE FROM public.ghl_field_mappings WHERE integration_id IS NULL;