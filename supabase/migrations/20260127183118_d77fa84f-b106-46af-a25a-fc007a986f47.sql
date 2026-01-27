-- Create table to track AI estimate generation jobs
CREATE TABLE public.estimate_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_json JSONB,
  error_message TEXT,
  request_params JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.estimate_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Create index for fast lookups
CREATE INDEX idx_estimate_generation_jobs_estimate_id ON public.estimate_generation_jobs(estimate_id);
CREATE INDEX idx_estimate_generation_jobs_status ON public.estimate_generation_jobs(status);

-- RLS policies
CREATE POLICY "Users can view jobs in their company"
  ON public.estimate_generation_jobs FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can create jobs in their company"
  ON public.estimate_generation_jobs FOR INSERT
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Users can update jobs in their company"
  ON public.estimate_generation_jobs FOR UPDATE
  USING (public.has_company_access(company_id));

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.estimate_generation_jobs;

-- Add trigger to auto-set company_id from user
CREATE TRIGGER set_estimate_generation_jobs_company_id
  BEFORE INSERT ON public.estimate_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();