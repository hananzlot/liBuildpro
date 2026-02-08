-- Allow project_id to be NULL for unassigned SMS messages
ALTER TABLE public.portal_chat_messages ALTER COLUMN project_id DROP NOT NULL;