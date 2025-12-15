-- Create table for GHL calendars
CREATE TABLE public.ghl_calendars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ghl_id TEXT NOT NULL UNIQUE,
  location_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  team_members TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ghl_calendars ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read calendars
CREATE POLICY "Users can view calendars" 
ON public.ghl_calendars 
FOR SELECT 
TO authenticated
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ghl_calendars_updated_at
BEFORE UPDATE ON public.ghl_calendars
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();