-- Create a table to track when project update notifications were last sent
CREATE TABLE public.project_notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL DEFAULT 'portal_update',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_to_email TEXT,
  sent_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_project_notification_log_project_id ON public.project_notification_log(project_id);
CREATE INDEX idx_project_notification_log_sent_at ON public.project_notification_log(sent_at);

-- Enable RLS
ALTER TABLE public.project_notification_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert and select
CREATE POLICY "Authenticated users can view notification logs"
ON public.project_notification_log
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert notification logs"
ON public.project_notification_log
FOR INSERT
TO authenticated
WITH CHECK (true);