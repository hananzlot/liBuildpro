-- Helper: check whether salesperson portal (anonymous) is allowed to upload to a given project
-- Uses SECURITY DEFINER so it can safely read required tables even when caller is anon.
CREATE OR REPLACE FUNCTION public.salesperson_portal_can_upload_to_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.salespeople sp
      ON sp.company_id = p.company_id
    JOIN public.salesperson_portal_tokens spt
      ON spt.salesperson_id = sp.id
     AND spt.company_id = sp.company_id
     AND spt.is_active = true
     AND (spt.expires_at IS NULL OR spt.expires_at > now())
    WHERE p.id = p_project_id
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
          AND sp.ghl_user_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.opportunities o
            WHERE o.assigned_to = sp.ghl_user_id
              AND o.company_id = p.company_id
              AND (o.id = p.opportunity_uuid OR o.ghl_id = p.opportunity_id)
          )
        )
      )
  );
$$;

-- Allow anon/public callers to execute the check function
GRANT EXECUTE ON FUNCTION public.salesperson_portal_can_upload_to_project(uuid) TO public;

-- Replace policy with one that:
-- 1) explicitly references storage.objects.name to avoid ambiguity
-- 2) delegates cross-table logic to SECURITY DEFINER helper
DROP POLICY IF EXISTS "Salesperson portal can upload to project-attachments" ON storage.objects;
CREATE POLICY "Salesperson portal can upload to project-attachments"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'project-attachments'
  AND (storage.foldername(objects.name))[1] = 'salesperson-uploads'
  AND (storage.foldername(objects.name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.salesperson_portal_can_upload_to_project(((storage.foldername(objects.name))[2])::uuid)
);
