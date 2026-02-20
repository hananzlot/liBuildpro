
-- Edge function execution logs for audit and troubleshooting
CREATE TABLE public.edge_function_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id),
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'timeout'
  duration_ms INTEGER,
  request_summary JSONB, -- key params (no secrets)
  response_summary JSONB, -- key results
  error_message TEXT,
  error_details TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_edge_function_logs_function ON public.edge_function_logs (function_name, created_at DESC);
CREATE INDEX idx_edge_function_logs_company ON public.edge_function_logs (company_id, created_at DESC);
CREATE INDEX idx_edge_function_logs_status ON public.edge_function_logs (status, created_at DESC);

-- Auto-cleanup: delete logs older than 30 days (via pg_cron or manual)
-- We'll keep this manual for now

-- Enable RLS
ALTER TABLE public.edge_function_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view logs for their company
CREATE POLICY "Admins can view company edge function logs"
  ON public.edge_function_logs FOR SELECT
  USING (public.has_company_access(company_id) AND public.is_admin(auth.uid()));

-- Super admins can view all logs
CREATE POLICY "Super admins can view all edge function logs"
  ON public.edge_function_logs FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Service role inserts (edge functions use service role)
-- No INSERT policy needed since edge functions use service_role key
