-- Create call_logs table for tracking phone calls from GHL
CREATE TABLE public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_message_id TEXT UNIQUE NOT NULL,
  conversation_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  direction TEXT, -- 'inbound' or 'outbound'
  call_date TIMESTAMPTZ,
  user_id TEXT,
  location_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access" ON public.call_logs FOR SELECT USING (true);
CREATE POLICY "Allow service role full access" ON public.call_logs FOR ALL USING (true) WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX idx_call_logs_contact_id ON public.call_logs(contact_id);
CREATE INDEX idx_call_logs_call_date ON public.call_logs(call_date);
CREATE INDEX idx_call_logs_user_id ON public.call_logs(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_call_logs_updated_at
BEFORE UPDATE ON public.call_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();