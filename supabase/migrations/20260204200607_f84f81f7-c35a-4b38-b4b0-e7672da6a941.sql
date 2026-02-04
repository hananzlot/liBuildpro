-- Change default value for auto_sync_to_quickbooks to true
ALTER TABLE public.projects 
ALTER COLUMN auto_sync_to_quickbooks SET DEFAULT true;