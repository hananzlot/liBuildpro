-- Create project_documents table for general project files
CREATE TABLE public.project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  category TEXT DEFAULT 'General',
  notes TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Production or admin can read project_documents"
ON public.project_documents FOR SELECT
USING (has_role(auth.uid(), 'production'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Production or admin can insert project_documents"
ON public.project_documents FOR INSERT
WITH CHECK (has_role(auth.uid(), 'production'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Production or admin can update project_documents"
ON public.project_documents FOR UPDATE
USING (has_role(auth.uid(), 'production'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Production or admin can delete project_documents"
ON public.project_documents FOR DELETE
USING (has_role(auth.uid(), 'production'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role project_documents"
ON public.project_documents FOR ALL
USING (true) WITH CHECK (true);