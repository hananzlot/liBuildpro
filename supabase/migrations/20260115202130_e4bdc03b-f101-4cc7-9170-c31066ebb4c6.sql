-- Add scope_of_work column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS scope_of_work text;