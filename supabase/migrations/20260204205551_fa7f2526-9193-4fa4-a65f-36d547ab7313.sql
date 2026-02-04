-- Allow created_by_id to be NULL for system-generated short links
ALTER TABLE public.short_links 
ALTER COLUMN created_by_id DROP NOT NULL;