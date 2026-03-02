-- Fix FK constraint that blocks user deletion
ALTER TABLE public.estimate_generation_jobs
  DROP CONSTRAINT estimate_generation_jobs_created_by_fkey;

ALTER TABLE public.estimate_generation_jobs
  ADD CONSTRAINT estimate_generation_jobs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;