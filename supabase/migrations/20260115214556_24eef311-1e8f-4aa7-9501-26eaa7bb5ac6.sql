-- Allow anonymous users to insert project_documents for portal uploads
CREATE POLICY "Portal customers can upload project_documents" 
ON public.project_documents 
FOR INSERT 
WITH CHECK (
  -- Allow insert if category is 'Customer Upload' (enforced by the application)
  category = 'Customer Upload'
);

-- Allow anonymous users to read documents for their project via portal token
CREATE POLICY "Portal customers can view project_documents" 
ON public.project_documents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens cpt 
    WHERE cpt.project_id = project_documents.project_id 
    AND cpt.is_active = true
  )
);

-- Create storage policy for portal uploads to project-attachments bucket
CREATE POLICY "Portal customers can upload to project-attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = 'customer-uploads'
);

-- Allow public read access to customer uploads
CREATE POLICY "Public can view customer uploads in project-attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = 'customer-uploads'
);