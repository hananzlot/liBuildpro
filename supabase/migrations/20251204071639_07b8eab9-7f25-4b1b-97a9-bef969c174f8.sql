-- Create table for GHL tasks
CREATE TABLE public.ghl_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ghl_id TEXT NOT NULL UNIQUE,
  location_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  assigned_to TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ghl_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access" 
ON public.ghl_tasks 
FOR SELECT 
USING (true);

CREATE POLICY "Allow service role full access" 
ON public.ghl_tasks 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_ghl_tasks_contact_id ON public.ghl_tasks(contact_id);
CREATE INDEX idx_ghl_tasks_completed ON public.ghl_tasks(completed);

-- Add trigger for updated_at
CREATE TRIGGER update_ghl_tasks_updated_at
BEFORE UPDATE ON public.ghl_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();