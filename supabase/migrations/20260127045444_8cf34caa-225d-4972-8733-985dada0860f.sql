-- Add ai_analysis JSONB column to store AI-generated sections
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS ai_analysis JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.estimates.ai_analysis IS 'Stores AI-generated analysis: project_understanding, assumptions, inclusions, exclusions, missing_info arrays';