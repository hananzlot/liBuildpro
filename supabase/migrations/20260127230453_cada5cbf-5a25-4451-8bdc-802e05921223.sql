-- Table to persist estimate builder drafts in the database
CREATE TABLE public.estimate_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  draft_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- One draft per user per company
  UNIQUE (user_id, company_id)
);

-- Enable RLS
ALTER TABLE public.estimate_drafts ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own drafts
CREATE POLICY "Users can manage their own drafts"
  ON public.estimate_drafts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_estimate_drafts_updated_at
  BEFORE UPDATE ON public.estimate_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();