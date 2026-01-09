-- Add estimated_project_cost column to projects table
-- This represents the estimated costs for the project, editable by users
-- If null, the UI will default to showing 50% of the original estimated_cost (from dispatch)
ALTER TABLE public.projects 
ADD COLUMN estimated_project_cost numeric NULL;