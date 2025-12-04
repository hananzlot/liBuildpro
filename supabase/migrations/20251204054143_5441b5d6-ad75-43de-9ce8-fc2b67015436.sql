-- Create tasks table for opportunity-related tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL,
  contact_id TEXT,
  assigned_to TEXT,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT,
  location_id TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access" 
ON public.tasks 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access" 
ON public.tasks 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access" 
ON public.tasks 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access" 
ON public.tasks 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();