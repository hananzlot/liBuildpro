-- Customer portal can upload to project-attachments/customer-uploads folder
DROP POLICY IF EXISTS "Customer portal can upload to project-attachments" ON storage.objects;
CREATE POLICY "Customer portal can upload to project-attachments"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = 'customer-uploads'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.client_portal_tokens cpt
    JOIN public.projects p ON p.id = cpt.project_id
    WHERE p.id = ((storage.foldername(name))[2])::uuid
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
      AND p.deleted_at IS NULL
  )
);

-- Customer portal can insert project_documents
DROP POLICY IF EXISTS "Customer portal can upload project_documents" ON public.project_documents;
CREATE POLICY "Customer portal can upload project_documents"
ON public.project_documents
FOR INSERT
TO public
WITH CHECK (
  category IN ('Customer Upload', 'Customer Photo')
  AND company_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.client_portal_tokens cpt
    JOIN public.projects p ON p.id = cpt.project_id
    WHERE p.id = project_documents.project_id
      AND cpt.company_id = project_documents.company_id
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
      AND p.deleted_at IS NULL
  )
);