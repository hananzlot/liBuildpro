-- Add last_synced_at column to track when records were last seen in a sync
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.ghl_tasks ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create indexes for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_contacts_last_synced ON public.contacts(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_last_synced ON public.opportunities(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_appointments_last_synced ON public.appointments(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_ghl_tasks_last_synced ON public.ghl_tasks(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_conversations_last_synced ON public.conversations(last_synced_at);