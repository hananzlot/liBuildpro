-- Create GHL users table to map user IDs to names
CREATE TABLE public.ghl_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ghl_id TEXT NOT NULL UNIQUE,
  location_id TEXT NOT NULL,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create opportunities table
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ghl_id TEXT NOT NULL UNIQUE,
  location_id TEXT NOT NULL,
  contact_id TEXT,
  pipeline_id TEXT,
  pipeline_stage_id TEXT,
  pipeline_name TEXT,
  stage_name TEXT,
  name TEXT,
  monetary_value DECIMAL(12, 2),
  status TEXT,
  assigned_to TEXT,
  ghl_date_added TIMESTAMP WITH TIME ZONE,
  ghl_date_updated TIMESTAMP WITH TIME ZONE,
  custom_fields JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ghl_id TEXT NOT NULL UNIQUE,
  location_id TEXT NOT NULL,
  contact_id TEXT,
  calendar_id TEXT,
  title TEXT,
  appointment_status TEXT,
  assigned_user_id TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  ghl_date_added TIMESTAMP WITH TIME ZONE,
  ghl_date_updated TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.ghl_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access
CREATE POLICY "Allow public read access" ON public.ghl_users FOR SELECT USING (true);
CREATE POLICY "Allow service role full access" ON public.ghl_users FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read access" ON public.opportunities FOR SELECT USING (true);
CREATE POLICY "Allow service role full access" ON public.opportunities FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read access" ON public.appointments FOR SELECT USING (true);
CREATE POLICY "Allow service role full access" ON public.appointments FOR ALL USING (true) WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_ghl_users_updated_at
  BEFORE UPDATE ON public.ghl_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();