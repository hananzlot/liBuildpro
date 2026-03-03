
-- Create pipelines table
CREATE TABLE public.pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pipelines in their company"
  ON public.pipelines FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

CREATE POLICY "Admins can manage pipelines"
  ON public.pipelines FOR ALL TO authenticated
  USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()))
  WITH CHECK (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- Add pipeline_id column to pipeline_stages (nullable for now to not break existing data)
ALTER TABLE public.pipeline_stages
  ADD COLUMN pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE;

-- Seed a default pipeline for each company from existing pipeline_stages
INSERT INTO public.pipelines (company_id, name, is_default, position)
SELECT DISTINCT ps.company_id,
  COALESCE(
    (SELECT cs.setting_value FROM company_settings cs 
     WHERE cs.company_id = ps.company_id AND cs.setting_key = 'default_pipeline_name'),
    'Main'
  ),
  true,
  0
FROM pipeline_stages ps
WHERE ps.company_id IS NOT NULL;

-- Link existing stages to their company's default pipeline
UPDATE pipeline_stages ps
SET pipeline_id = p.id
FROM pipelines p
WHERE p.company_id = ps.company_id
  AND p.is_default = true
  AND ps.pipeline_id IS NULL;

-- Update auto-seed trigger to also create a default pipeline
CREATE OR REPLACE FUNCTION public.auto_seed_pipeline_stages()
RETURNS trigger AS $$
DECLARE
  v_pipeline_id UUID;
BEGIN
  -- Create default pipeline
  INSERT INTO public.pipelines (company_id, name, is_default, position)
  VALUES (NEW.id, 'Main', true, 0)
  RETURNING id INTO v_pipeline_id;

  INSERT INTO public.pipeline_stages (company_id, pipeline_id, name, position)
  VALUES
    (NEW.id, v_pipeline_id, 'New Lead', 0),
    (NEW.id, v_pipeline_id, 'No Answer', 1),
    (NEW.id, v_pipeline_id, 'Contacted', 2),
    (NEW.id, v_pipeline_id, 'Appointment Scheduled', 3),
    (NEW.id, v_pipeline_id, '2nd Appointment', 4),
    (NEW.id, v_pipeline_id, 'Estimate Prepared', 5),
    (NEW.id, v_pipeline_id, 'Proposal Sent', 6),
    (NEW.id, v_pipeline_id, 'Close to Sale', 7),
    (NEW.id, v_pipeline_id, 'Won', 8),
    (NEW.id, v_pipeline_id, 'Lost/DNC', 9);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
