-- Add completion_date column to projects table
ALTER TABLE public.projects 
ADD COLUMN completion_date date NULL;