-- Create ghl_pipelines table to store all pipelines and their stages
CREATE TABLE IF NOT EXISTS public.ghl_pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ghl_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  name TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ghl_id, location_id)
);

-- Enable Row Level Security
ALTER TABLE public.ghl_pipelines ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read pipelines
CREATE POLICY "Users can view pipelines" 
ON public.ghl_pipelines 
FOR SELECT 
USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_ghl_pipelines_updated_at
BEFORE UPDATE ON public.ghl_pipelines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();