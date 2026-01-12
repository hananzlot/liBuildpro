-- Create app_version table to track version numbers
CREATE TABLE public.app_version (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_number numeric(5,2) NOT NULL DEFAULT 2.20,
  deployed_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_version ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read version (needed for cache check)
CREATE POLICY "Anyone can view app version"
  ON public.app_version
  FOR SELECT
  TO authenticated
  USING (true);

-- Only super_admin can insert/update versions
CREATE POLICY "Super admins can manage versions"
  ON public.app_version
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Insert initial version
INSERT INTO public.app_version (version_number, notes) VALUES (2.20, 'Initial version tracking');