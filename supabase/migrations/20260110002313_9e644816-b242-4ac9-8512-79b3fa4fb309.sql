-- Create banks table for storing bank names
CREATE TABLE public.banks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view banks"
  ON public.banks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Production or admin can insert banks"
  ON public.banks FOR INSERT
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'production'));

CREATE POLICY "Production or admin can update banks"
  ON public.banks FOR UPDATE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'production'));

CREATE POLICY "Admin can delete banks"
  ON public.banks FOR DELETE
  USING (is_admin(auth.uid()));

-- Insert some common bank names as seed data
INSERT INTO public.banks (name) VALUES
  ('Bank of America'),
  ('Chase'),
  ('Wells Fargo'),
  ('Citi'),
  ('US Bank'),
  ('PNC Bank'),
  ('Capital One'),
  ('TD Bank'),
  ('Truist'),
  ('Fifth Third Bank')
ON CONFLICT (name) DO NOTHING;