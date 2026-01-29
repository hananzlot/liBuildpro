-- Salesperson portal project_documents: align with portal access logic
-- Allow upload if: the salesperson has an active token AND
-- (is assigned to the project OR project is linked via opportunity without any assigned salesperson)

DROP POLICY IF EXISTS "Salesperson portal can upload project_documents" ON public.project_documents;
CREATE POLICY "Salesperson portal can upload project_documents"
ON public.project_documents
FOR INSERT
TO public
WITH CHECK (
  category IN ('Salesperson Photo', 'Salesperson Upload')
  AND uploaded_by IS NOT NULL
  AND company_id IS NOT NULL
  AND EXISTS (
    -- Get the salesperson for the uploaded_by id
    SELECT 1
    FROM public.salespeople sp
    JOIN public.salesperson_portal_tokens spt
      ON spt.salesperson_id = sp.id
     AND spt.company_id = sp.company_id
     AND spt.is_active = true
     AND (spt.expires_at IS NULL OR spt.expires_at > now())
    JOIN public.projects p
      ON p.id = project_documents.project_id
     AND p.company_id = project_documents.company_id
     AND p.deleted_at IS NULL
    WHERE sp.id = project_documents.uploaded_by
      AND sp.company_id = project_documents.company_id
      AND (
        -- Condition 1: Salesperson is directly assigned
        sp.name = p.primary_salesperson
        OR sp.name = p.secondary_salesperson
        OR sp.name = p.tertiary_salesperson
        OR sp.name = p.quaternary_salesperson
        -- Condition 2: Project linked via opportunity, no salesperson assigned
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

-- Similarly update the storage policy for salesperson-uploads to match
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
        -- Condition 1: Salesperson is directly assigned
        sp.name = p.primary_salesperson
        OR sp.name = p.secondary_salesperson
        OR sp.name = p.tertiary_salesperson
        OR sp.name = p.quaternary_salesperson
        -- Condition 2: Project linked via opportunity, no salesperson assigned
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
