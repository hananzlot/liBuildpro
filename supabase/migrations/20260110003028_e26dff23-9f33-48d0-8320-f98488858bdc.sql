-- Create trades table for dynamic trade types
CREATE TABLE public.trades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view trades
CREATE POLICY "Anyone can view trades" ON public.trades
  FOR SELECT USING (true);

-- Allow super admins to insert trades
CREATE POLICY "Super admins can insert trades" ON public.trades
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Allow super admins to update trades
CREATE POLICY "Super admins can update trades" ON public.trades
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Allow super admins to delete trades
CREATE POLICY "Super admins can delete trades" ON public.trades
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Seed with existing trade types
INSERT INTO public.trades (name) VALUES
  ('Carpentry'),
  ('Concrete'),
  ('Drywall'),
  ('Electrical'),
  ('Flooring'),
  ('General'),
  ('HVAC'),
  ('Insulation'),
  ('Landscaping'),
  ('Masonry'),
  ('Other'),
  ('Painting'),
  ('Plumbing'),
  ('Roofing'),
  ('Windows & Doors')
ON CONFLICT (name) DO NOTHING;