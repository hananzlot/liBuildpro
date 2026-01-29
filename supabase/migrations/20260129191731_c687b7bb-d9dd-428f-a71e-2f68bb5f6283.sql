-- Allow uploading/deleting project photos in the shared project-attachments bucket
-- Path convention: project-photos/<project_id>/<filename>

-- Insert policy (upload)
DROP POLICY IF EXISTS "Upload project photos" ON storage.objects;
CREATE POLICY "Upload project photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = 'project-photos'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND COALESCE(
    public.has_company_access(
      (
        SELECT p.company_id
        FROM public.projects p
        WHERE p.id = ((storage.foldername(name))[2])::uuid
          AND p.deleted_at IS NULL
        LIMIT 1
      )
    ),
    false
  )
);

-- Delete policy (remove)
DROP POLICY IF EXISTS "Delete project photos" ON storage.objects;
CREATE POLICY "Delete project photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = 'project-photos'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND COALESCE(
    public.has_company_access(
      (
        SELECT p.company_id
        FROM public.projects p
        WHERE p.id = ((storage.foldername(name))[2])::uuid
          AND p.deleted_at IS NULL
        LIMIT 1
      )
    ),
    false
  )
);

-- Update policy (covers overwrite-style operations if ever used)
DROP POLICY IF EXISTS "Update project photos" ON storage.objects;
CREATE POLICY "Update project photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = 'project-photos'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND COALESCE(
    public.has_company_access(
      (
        SELECT p.company_id
        FROM public.projects p
        WHERE p.id = ((storage.foldername(name))[2])::uuid
          AND p.deleted_at IS NULL
        LIMIT 1
      )
    ),
    false
  )
)
WITH CHECK (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = 'project-photos'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND COALESCE(
    public.has_company_access(
      (
        SELECT p.company_id
        FROM public.projects p
        WHERE p.id = ((storage.foldername(name))[2])::uuid
          AND p.deleted_at IS NULL
        LIMIT 1
      )
    ),
    false
  )
);
