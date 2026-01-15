-- Add project_id to estimates table to link proposals to projects
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

-- Create portal_chat_messages table for real-time customer chat
CREATE TABLE public.portal_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  portal_token_id uuid REFERENCES public.client_portal_tokens(id),
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'staff')),
  sender_name text NOT NULL,
  sender_email text,
  sender_user_id uuid REFERENCES public.profiles(id),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_portal_chat_messages_project_id ON public.portal_chat_messages(project_id);
CREATE INDEX idx_portal_chat_messages_created_at ON public.portal_chat_messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.portal_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public insert for customer messages (portal access via token validation in app)
CREATE POLICY "Allow public insert for portal chat" 
ON public.portal_chat_messages 
FOR INSERT 
WITH CHECK (true);

-- Policy: Allow public select for portal chat (token validation done in app)
CREATE POLICY "Allow public select for portal chat" 
ON public.portal_chat_messages 
FOR SELECT 
USING (true);

-- Policy: Allow staff to update messages (mark as read)
CREATE POLICY "Staff can update portal chat" 
ON public.portal_chat_messages 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Enable realtime for the chat messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_chat_messages;

-- Add trigger for updated_at
CREATE TRIGGER update_portal_chat_messages_updated_at
BEFORE UPDATE ON public.portal_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();