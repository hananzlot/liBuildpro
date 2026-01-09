-- Add deleted_at column to projects for soft delete
ALTER TABLE public.projects ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for filtering non-deleted projects
CREATE INDEX idx_projects_deleted_at ON public.projects(deleted_at);

-- Add comment for clarity
COMMENT ON COLUMN public.projects.deleted_at IS 'Timestamp when project was soft-deleted, NULL means active';