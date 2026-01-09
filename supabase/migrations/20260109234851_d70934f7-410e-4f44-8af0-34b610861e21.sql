-- Create table for custom project statuses
CREATE TABLE public.project_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create table for custom project types
CREATE TABLE public.project_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_types ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_statuses
CREATE POLICY "Anyone can read project_statuses"
ON public.project_statuses FOR SELECT
USING (true);

CREATE POLICY "Super admins can insert project_statuses"
ON public.project_statuses FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update project_statuses"
ON public.project_statuses FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete project_statuses"
ON public.project_statuses FOR DELETE
USING (has_role(auth.uid(), 'super_admin'));

-- RLS policies for project_types
CREATE POLICY "Anyone can read project_types"
ON public.project_types FOR SELECT
USING (true);

CREATE POLICY "Super admins can insert project_types"
ON public.project_types FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update project_types"
ON public.project_types FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete project_types"
ON public.project_types FOR DELETE
USING (has_role(auth.uid(), 'super_admin'));

-- Insert default statuses
INSERT INTO public.project_statuses (name, sort_order, is_default) VALUES
  ('New Job', 1, true),
  ('In-Progress', 2, true),
  ('On-Hold', 3, true),
  ('Completed', 4, true),
  ('Cancelled', 5, true);

-- Insert default project types
INSERT INTO public.project_types (name, sort_order, is_default) VALUES
  ('Bathroom', 1, true),
  ('Kitchen', 2, true),
  ('Backyard', 3, true),
  ('Pool', 4, true),
  ('ADU', 5, true),
  ('Full Remodel', 6, true),
  ('Room Addition', 7, true),
  ('Roofing', 8, true),
  ('Flooring', 9, true),
  ('Painting', 10, true),
  ('Landscaping', 11, true),
  ('HVAC', 12, true),
  ('Plumbing', 13, true),
  ('Electrical', 14, true),
  ('Windows & Doors', 15, true),
  ('Other', 100, true);