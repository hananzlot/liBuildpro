-- Create conversations table for GHL conversation data
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ghl_id TEXT NOT NULL UNIQUE,
  location_id TEXT NOT NULL,
  contact_id TEXT,
  type TEXT,
  unread_count INTEGER DEFAULT 0,
  inbox_status TEXT,
  last_message_body TEXT,
  last_message_date TIMESTAMP WITH TIME ZONE,
  last_message_type TEXT,
  last_message_direction TEXT,
  ghl_date_added TIMESTAMP WITH TIME ZONE,
  ghl_date_updated TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (matching other tables)
CREATE POLICY "Allow public read access" 
ON public.conversations 
FOR SELECT 
USING (true);

CREATE POLICY "Allow service role full access" 
ON public.conversations 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for faster lookups by contact
CREATE INDEX idx_conversations_contact_id ON public.conversations(contact_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();