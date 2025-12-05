-- Create table to track sent reminders (prevents duplicates)
CREATE TABLE public.appointment_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL,
  appointment_ghl_id TEXT NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('1_day', '2_hours')),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('sales_rep', 'contact')),
  recipient_email TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate reminders
CREATE UNIQUE INDEX idx_unique_reminder 
ON public.appointment_reminders (appointment_ghl_id, reminder_type, recipient_type);

-- Enable RLS
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Allow service role full access on reminders"
ON public.appointment_reminders
FOR ALL
USING (true)
WITH CHECK (true);

-- Allow authenticated users to read reminders
CREATE POLICY "Allow authenticated read access on reminders"
ON public.appointment_reminders
FOR SELECT
USING (true);

-- Create notifications table for in-app alerts
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ghl_user_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'reminder',
  read BOOLEAN NOT NULL DEFAULT false,
  appointment_ghl_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id OR ghl_user_id IN (
  SELECT ghl_user_id FROM profiles WHERE id = auth.uid()
));

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id OR ghl_user_id IN (
  SELECT ghl_user_id FROM profiles WHERE id = auth.uid()
));

-- Service role can insert notifications
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);