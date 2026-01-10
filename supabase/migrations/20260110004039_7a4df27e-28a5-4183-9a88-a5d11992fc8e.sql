-- Create project_notes table for recording notes on projects
CREATE TABLE public.project_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view notes
CREATE POLICY "Anyone can view project notes" ON public.project_notes
  FOR SELECT USING (true);

-- Allow authenticated users to insert notes
CREATE POLICY "Authenticated users can insert project notes" ON public.project_notes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update their own notes
CREATE POLICY "Users can update their own notes" ON public.project_notes
  FOR UPDATE USING (auth.uid() = created_by);

-- Allow users to delete their own notes or admins
CREATE POLICY "Users can delete their own notes" ON public.project_notes
  FOR DELETE USING (auth.uid() = created_by);

-- Create trigger for updated_at
CREATE TRIGGER update_project_notes_updated_at
  BEFORE UPDATE ON public.project_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();