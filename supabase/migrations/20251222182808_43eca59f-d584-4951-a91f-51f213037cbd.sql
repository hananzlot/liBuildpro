-- Create task_edits table to track all task edit history
CREATE TABLE public.task_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_ghl_id TEXT NOT NULL,
  contact_ghl_id TEXT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  edited_by UUID NULL,
  edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  location_id TEXT NULL,
  CONSTRAINT task_edits_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.profiles(id)
);

-- Create note_edits table to track all note edit history
CREATE TABLE public.note_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_ghl_id TEXT NOT NULL,
  contact_ghl_id TEXT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  edited_by UUID NULL,
  edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  location_id TEXT NULL,
  CONSTRAINT note_edits_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.profiles(id)
);

-- Create appointment_edits table to track all appointment edit history
CREATE TABLE public.appointment_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_ghl_id TEXT NOT NULL,
  contact_ghl_id TEXT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  edited_by UUID NULL,
  edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  location_id TEXT NULL,
  CONSTRAINT appointment_edits_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.profiles(id)
);

-- Enable RLS on all tables
ALTER TABLE public.task_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_edits ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_edits
CREATE POLICY "Allow authenticated read access on task_edits"
ON public.task_edits FOR SELECT
USING (true);

CREATE POLICY "Allow service role full access on task_edits"
ON public.task_edits FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies for note_edits  
CREATE POLICY "Allow authenticated read access on note_edits"
ON public.note_edits FOR SELECT
USING (true);

CREATE POLICY "Allow service role full access on note_edits"
ON public.note_edits FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies for appointment_edits
CREATE POLICY "Allow authenticated read access on appointment_edits"
ON public.appointment_edits FOR SELECT
USING (true);

CREATE POLICY "Allow service role full access on appointment_edits"
ON public.appointment_edits FOR ALL
USING (true)
WITH CHECK (true);

-- Add indexes for common queries
CREATE INDEX idx_task_edits_task_ghl_id ON public.task_edits(task_ghl_id);
CREATE INDEX idx_task_edits_edited_at ON public.task_edits(edited_at);
CREATE INDEX idx_task_edits_edited_by ON public.task_edits(edited_by);

CREATE INDEX idx_note_edits_note_ghl_id ON public.note_edits(note_ghl_id);
CREATE INDEX idx_note_edits_edited_at ON public.note_edits(edited_at);
CREATE INDEX idx_note_edits_edited_by ON public.note_edits(edited_by);

CREATE INDEX idx_appointment_edits_appointment_ghl_id ON public.appointment_edits(appointment_ghl_id);
CREATE INDEX idx_appointment_edits_edited_at ON public.appointment_edits(edited_at);
CREATE INDEX idx_appointment_edits_edited_by ON public.appointment_edits(edited_by);