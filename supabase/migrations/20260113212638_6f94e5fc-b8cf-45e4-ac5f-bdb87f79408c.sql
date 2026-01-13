-- Add due_date column to project_checklists table
ALTER TABLE public.project_checklists 
ADD COLUMN due_date date NULL;