-- Create app_settings table for configurable settings
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type TEXT DEFAULT 'text', -- text, number, boolean, json
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can read settings"
  ON public.app_settings FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete settings"
  ON public.app_settings FOR DELETE
  USING (is_admin(auth.uid()));

-- Insert default Resend settings
INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description) VALUES
  ('resend_from_email', 'proposals@caprobuilders.com', 'text', 'Email address to send proposals from (must be verified in Resend)'),
  ('resend_from_name', 'Capro Builders', 'text', 'Display name for outgoing emails'),
  ('company_name', 'Capro Builders', 'text', 'Company name used in emails and documents');