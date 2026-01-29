-- FIX production: Storage policy was using sp.name instead of name (the storage object path)
DROP POLICY IF EXISTS "Salesperson portal can upload to project-attachments" ON storage.objects;
CREATE POLICY "Salesperson portal can upload to project-attachments"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = 'salesperson-uploads'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.salespeople sp
      ON sp.company_id = p.company_id
    JOIN public.salesperson_portal_tokens spt
      ON spt.salesperson_id = sp.id
     AND spt.company_id = sp.company_id
     AND spt.is_active = true
     AND (spt.expires_at IS NULL OR spt.expires_at > now())
    WHERE p.id = ((storage.foldername(name))[2])::uuid
      AND p.deleted_at IS NULL
      AND (
        -- Salesperson is directly assigned
        sp.name = p.primary_salesperson
        OR sp.name = p.secondary_salesperson
        OR sp.name = p.tertiary_salesperson
        OR sp.name = p.quaternary_salesperson
        -- OR project linked via opportunity with no salesperson assigned
        OR (
          p.primary_salesperson IS NULL
          AND p.secondary_salesperson IS NULL
          AND p.tertiary_salesperson IS NULL
          AND p.quaternary_salesperson IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.opportunities o
            WHERE o.assigned_to = sp.ghl_user_id
              AND o.company_id = p.company_id
              AND (o.id = p.opportunity_uuid OR o.ghl_id = p.opportunity_id)
          )
        )
      )
  )
);