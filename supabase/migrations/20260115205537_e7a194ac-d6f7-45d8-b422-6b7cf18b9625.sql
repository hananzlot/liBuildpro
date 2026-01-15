-- Add setting for daily portal email cron (default disabled)
INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'daily_portal_email_enabled',
  'false',
  'boolean',
  'Enable/disable automatic daily portal update emails to customers'
) ON CONFLICT (setting_key) DO NOTHING;

-- Create archived chat messages table
CREATE TABLE public.portal_chat_messages_archived (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_type VARCHAR(50) NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  sender_email VARCHAR(255),
  sender_user_id UUID,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  portal_token_id UUID,
  original_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  original_updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_chat_messages_archived ENABLE ROW LEVEL SECURITY;

-- RLS policies for archived chat (admin/super_admin only)
CREATE POLICY "Admins can view archived chats"
ON public.portal_chat_messages_archived
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = auth.uid()
    AND (u.raw_user_meta_data->>'role' IN ('admin', 'super_admin'))
  )
);

CREATE POLICY "Admins can delete archived chats"
ON public.portal_chat_messages_archived
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = auth.uid()
    AND (u.raw_user_meta_data->>'role' IN ('admin', 'super_admin'))
  )
);

-- Create indexes
CREATE INDEX idx_archived_chat_project_id ON public.portal_chat_messages_archived(project_id);
CREATE INDEX idx_archived_chat_archived_at ON public.portal_chat_messages_archived(archived_at);

-- Add column to notification log to track if it was manual or automated
ALTER TABLE public.project_notification_log ADD COLUMN IF NOT EXISTS is_automated BOOLEAN DEFAULT false;