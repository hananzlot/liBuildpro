-- Add auto_sync_to_quickbooks flag to projects table
ALTER TABLE public.projects
ADD COLUMN auto_sync_to_quickbooks boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.auto_sync_to_quickbooks IS 'Controls whether this project automatically syncs financial data to QuickBooks';