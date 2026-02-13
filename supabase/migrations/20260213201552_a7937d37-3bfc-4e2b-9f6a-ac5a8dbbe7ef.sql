
CREATE OR REPLACE FUNCTION public.auto_seed_pipeline_stages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.pipeline_stages (company_id, name, position) VALUES
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
$$;

CREATE TRIGGER trg_auto_seed_pipeline_stages
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.auto_seed_pipeline_stages();
