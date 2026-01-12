-- Add legacy_project_number column for imported project references
ALTER TABLE public.projects 
ADD COLUMN legacy_project_number TEXT;

-- Add comment to document the column's purpose
COMMENT ON COLUMN public.projects.legacy_project_number IS 'Legacy project number from imported data - visible to admins only';