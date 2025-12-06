-- Create table for storing estimated costs per project/opportunity
CREATE TABLE public.project_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  estimated_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  entered_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_costs ENABLE ROW LEVEL SECURITY;

-- Create policies for access
CREATE POLICY "Allow authenticated read access on project_costs" 
ON public.project_costs 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated insert on project_costs" 
ON public.project_costs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on project_costs" 
ON public.project_costs 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow authenticated delete on project_costs" 
ON public.project_costs 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_project_costs_updated_at
BEFORE UPDATE ON public.project_costs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create unique constraint to ensure one cost entry per opportunity
CREATE UNIQUE INDEX idx_project_costs_opportunity_unique ON public.project_costs(opportunity_id);