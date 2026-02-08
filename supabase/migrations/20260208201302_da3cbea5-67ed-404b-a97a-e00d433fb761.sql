-- Add SMS fields to portal_chat_messages to track SMS origin
ALTER TABLE public.portal_chat_messages
ADD COLUMN IF NOT EXISTS sms_phone_number TEXT,
ADD COLUMN IF NOT EXISTS twilio_message_sid TEXT,
ADD COLUMN IF NOT EXISTS is_sms BOOLEAN DEFAULT false;

-- Create index for quick SMS lookups
CREATE INDEX IF NOT EXISTS idx_portal_chat_is_sms ON public.portal_chat_messages(is_sms) WHERE is_sms = true;
CREATE INDEX IF NOT EXISTS idx_portal_chat_twilio_sid ON public.portal_chat_messages(twilio_message_sid) WHERE twilio_message_sid IS NOT NULL;