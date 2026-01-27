-- Create table to track AI generation queue per company
CREATE TABLE public.estimate_generation_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.estimate_generation_jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'processing', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(job_id)
);

-- Create index for efficient queue queries
CREATE INDEX idx_estimate_queue_company_status ON public.estimate_generation_queue(company_id, status, position);
CREATE INDEX idx_estimate_queue_job ON public.estimate_generation_queue(job_id);

-- Enable RLS
ALTER TABLE public.estimate_generation_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can see queue entries for their company
CREATE POLICY "Users can view their company queue"
  ON public.estimate_generation_queue
  FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can insert into their company queue"
  ON public.estimate_generation_queue
  FOR INSERT
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Users can update their company queue"
  ON public.estimate_generation_queue
  FOR UPDATE
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can delete from their company queue"
  ON public.estimate_generation_queue
  FOR DELETE
  USING (public.has_company_access(company_id));

-- Enable realtime for queue updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.estimate_generation_queue;

-- Function to get next queue position for a company
CREATE OR REPLACE FUNCTION public.get_next_queue_position(p_company_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(MAX(position), 0) + 1
  FROM public.estimate_generation_queue
  WHERE company_id = p_company_id
    AND status IN ('waiting', 'processing');
$$;

-- Function to advance queue when a job completes
CREATE OR REPLACE FUNCTION public.advance_estimate_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When a job is completed or failed, update positions for remaining queue items
  IF NEW.status IN ('completed', 'failed', 'cancelled') AND OLD.status IN ('waiting', 'processing') THEN
    -- Decrement position for all waiting items in the same company queue
    UPDATE public.estimate_generation_queue
    SET position = position - 1
    WHERE company_id = NEW.company_id
      AND status = 'waiting'
      AND position > OLD.position;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for queue advancement
CREATE TRIGGER trigger_advance_estimate_queue
  AFTER UPDATE ON public.estimate_generation_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.advance_estimate_queue();