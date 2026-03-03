
-- Seed default pipeline stages for companies that don't have any
INSERT INTO public.pipeline_stages (company_id, name, position)
SELECT c.id, s.name, s.position
FROM companies c
CROSS JOIN (
  VALUES 
    ('New Lead', 0),
    ('No Answer', 1),
    ('Contacted', 2),
    ('Appointment Scheduled', 3),
    ('2nd Appointment', 4),
    ('Estimate Prepared', 5),
    ('Proposal Sent', 6),
    ('Close to Sale', 7),
    ('Won', 8),
    ('Lost/DNC', 9)
) AS s(name, position)
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps WHERE ps.company_id = c.id
);

-- Create trigger to auto-seed pipeline stages for new companies
CREATE OR REPLACE FUNCTION public.auto_seed_pipeline_stages()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.pipeline_stages (company_id, name, position)
  VALUES
    (NEW.id, 'New Lead', 0),
    (NEW.id, 'No Answer', 1),
    (NEW.id, 'Contacted', 2),
    (NEW.id, 'Appointment Scheduled', 3),
    (NEW.id, '2nd Appointment', 4),
    (NEW.id, 'Estimate Prepared', 5),
    (NEW.id, 'Proposal Sent', 6),
    (NEW.id, 'Close to Sale', 7),
    (NEW.id, 'Won', 8),
    (NEW.id, 'Lost/DNC', 9);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_seed_pipeline_stages ON public.companies;
CREATE TRIGGER trg_auto_seed_pipeline_stages
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.auto_seed_pipeline_stages();
