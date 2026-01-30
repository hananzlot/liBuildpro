-- Create pipeline_stages table with UUIDs
CREATE TABLE public.pipeline_stages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (company_id, name)
);

-- Enable RLS
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their company pipeline stages"
ON public.pipeline_stages
FOR SELECT
USING (public.has_company_access(company_id));

CREATE POLICY "Admins can manage pipeline stages"
ON public.pipeline_stages
FOR ALL
USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- Add index on company_id for efficient lookups
CREATE INDEX idx_pipeline_stages_company_id ON public.pipeline_stages(company_id);

-- Create update trigger for updated_at
CREATE TRIGGER update_pipeline_stages_updated_at
BEFORE UPDATE ON public.pipeline_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to migrate opportunities when stage name changes
CREATE OR REPLACE FUNCTION public.migrate_opportunities_to_stage_uuid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- When a stage name is updated, update all opportunities that reference the old stage name
    IF TG_OP = 'UPDATE' AND OLD.name IS DISTINCT FROM NEW.name THEN
        UPDATE public.opportunities
        SET 
            stage_name = NEW.name,
            pipeline_stage_id = NEW.id::text,
            updated_at = now()
        WHERE company_id = NEW.company_id
          AND (
              stage_name = OLD.name 
              OR LOWER(TRIM(stage_name)) = LOWER(TRIM(OLD.name))
          );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to auto-migrate opportunities on stage name change
CREATE TRIGGER trigger_migrate_opportunities_on_stage_rename
AFTER UPDATE ON public.pipeline_stages
FOR EACH ROW
EXECUTE FUNCTION public.migrate_opportunities_to_stage_uuid();

-- Create function to assign UUIDs to opportunities with matching stage names on insert
CREATE OR REPLACE FUNCTION public.assign_stage_uuid_to_opportunities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- When a new stage is created, update opportunities that have matching stage_name but no pipeline_stage_id
    UPDATE public.opportunities
    SET 
        pipeline_stage_id = NEW.id::text,
        updated_at = now()
    WHERE company_id = NEW.company_id
      AND (
          stage_name = NEW.name 
          OR LOWER(TRIM(stage_name)) = LOWER(TRIM(NEW.name))
      )
      AND (pipeline_stage_id IS NULL OR pipeline_stage_id = '');
      
    RETURN NEW;
END;
$$;

-- Create trigger to assign UUIDs on new stage creation
CREATE TRIGGER trigger_assign_stage_uuid_on_insert
AFTER INSERT ON public.pipeline_stages
FOR EACH ROW
EXECUTE FUNCTION public.assign_stage_uuid_to_opportunities();