-- Create project_note_comments table for comments on notes
CREATE TABLE public.project_note_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id uuid NOT NULL REFERENCES public.project_notes(id) ON DELETE CASCADE,
  comment_text text NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_note_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all comments
CREATE POLICY "Authenticated users can view all comments"
ON public.project_note_comments
FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert their own comments
CREATE POLICY "Authenticated users can insert their own comments"
ON public.project_note_comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Policy: Only admins can delete comments
CREATE POLICY "Admins can delete comments"
ON public.project_note_comments
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Create index for performance
CREATE INDEX idx_project_note_comments_note_id ON public.project_note_comments(note_id);