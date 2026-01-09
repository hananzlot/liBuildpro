-- Create storage bucket for project attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-attachments', 'project-attachments', true);

-- Allow production/admin users to upload files
CREATE POLICY "Production or admin can upload project attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-attachments' 
  AND (
    has_role(auth.uid(), 'production'::app_role) 
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Allow production/admin users to view files
CREATE POLICY "Production or admin can view project attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-attachments'
  AND (
    has_role(auth.uid(), 'production'::app_role) 
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Allow production/admin users to update files
CREATE POLICY "Production or admin can update project attachments"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-attachments'
  AND (
    has_role(auth.uid(), 'production'::app_role) 
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Allow production/admin users to delete files
CREATE POLICY "Production or admin can delete project attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-attachments'
  AND (
    has_role(auth.uid(), 'production'::app_role) 
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Service role full access
CREATE POLICY "Service role full access project attachments"
ON storage.objects FOR ALL
USING (bucket_id = 'project-attachments' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'project-attachments' AND auth.role() = 'service_role');