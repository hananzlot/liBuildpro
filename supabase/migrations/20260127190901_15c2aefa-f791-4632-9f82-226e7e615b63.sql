-- Add stage tracking columns to estimate_generation_jobs for multi-stage AI processing
ALTER TABLE estimate_generation_jobs
ADD COLUMN IF NOT EXISTS current_stage TEXT,
ADD COLUMN IF NOT EXISTS total_stages INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS stage_results JSONB DEFAULT '{}'::jsonb;

-- Add index for better query performance when looking up jobs by stage
CREATE INDEX IF NOT EXISTS idx_estimate_generation_jobs_current_stage 
ON estimate_generation_jobs(current_stage) 
WHERE current_stage IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN estimate_generation_jobs.current_stage IS 'Current stage: PLAN_DIGEST | ESTIMATE_PLAN | GROUP_ITEMS:GroupName | FINAL_ASSEMBLY';
COMMENT ON COLUMN estimate_generation_jobs.total_stages IS 'Total number of stages (4 base + N groups)';
COMMENT ON COLUMN estimate_generation_jobs.stage_results IS 'Intermediate results per stage for recovery/debugging';