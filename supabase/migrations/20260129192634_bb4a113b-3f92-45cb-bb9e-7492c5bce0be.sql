-- Tighten overly-permissive RLS policies flagged by the linter
-- and enable secure-ish uploads from the Salesperson Portal + Customer Portal.

-- =========================
-- storage.objects (project-attachments)
-- =========================

-- Customer uploads: require an active portal token for that project
DROP POLICY IF EXISTS "Portal customers can upload to project-attachments" ON storage.objects;
CREATE POLICY "Portal customers can upload to project-attachments"
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
    WHERE cpt.project_id = ((storage.foldername(name))[2])::uuid
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
);

-- Salesperson uploads: require that the project has an assigned salesperson with an active portal token
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
     AND (
       sp.name = p.primary_salesperson
       OR sp.name = p.secondary_salesperson
       OR sp.name = p.tertiary_salesperson
       OR sp.name = p.quaternary_salesperson
     )
    JOIN public.salesperson_portal_tokens spt
      ON spt.salesperson_id = sp.id
     AND spt.company_id = p.company_id
     AND spt.is_active = true
     AND (spt.expires_at IS NULL OR spt.expires_at > now())
    WHERE p.id = ((storage.foldername(name))[2])::uuid
      AND p.deleted_at IS NULL
  )
);

-- =========================
-- public.project_documents
-- =========================

-- Portal customers: require an active portal token for the project (and keep category restriction)
DROP POLICY IF EXISTS "Portal customers can upload project_documents" ON public.project_documents;
CREATE POLICY "Portal customers can upload project_documents"
ON public.project_documents
FOR INSERT
TO public
WITH CHECK (
  category = 'Customer Upload'
  AND EXISTS (
    SELECT 1
    FROM public.client_portal_tokens cpt
    WHERE cpt.project_id = project_documents.project_id
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
);

-- Salesperson portal: allow insert only when uploaded_by matches an assigned salesperson with an active token
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
    SELECT 1
    FROM public.projects p
    JOIN public.salespeople sp
      ON sp.id = project_documents.uploaded_by
     AND sp.company_id = p.company_id
     AND (
       sp.name = p.primary_salesperson
       OR sp.name = p.secondary_salesperson
       OR sp.name = p.tertiary_salesperson
       OR sp.name = p.quaternary_salesperson
     )
    JOIN public.salesperson_portal_tokens spt
      ON spt.salesperson_id = sp.id
     AND spt.company_id = p.company_id
     AND spt.is_active = true
     AND (spt.expires_at IS NULL OR spt.expires_at > now())
    WHERE p.id = project_documents.project_id
      AND p.company_id = project_documents.company_id
      AND p.deleted_at IS NULL
  )
);

-- =========================
-- Fix linter warnings: WITH CHECK (true)
-- =========================

-- notifications: only service_role may insert
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

-- portal_chat_messages: restrict public insert/select to valid portal tokens
DROP POLICY IF EXISTS "Allow public insert for portal chat" ON public.portal_chat_messages;
DROP POLICY IF EXISTS "Allow public select for portal chat" ON public.portal_chat_messages;

CREATE POLICY "Portal visitors can view portal chat"
ON public.portal_chat_messages
FOR SELECT
TO public
USING (
  portal_token_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.client_portal_tokens cpt
    WHERE cpt.id = portal_chat_messages.portal_token_id
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
      AND cpt.project_id = portal_chat_messages.project_id
  )
);

CREATE POLICY "Portal visitors can insert portal chat"
ON public.portal_chat_messages
FOR INSERT
TO public
WITH CHECK (
  portal_token_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.client_portal_tokens cpt
    WHERE cpt.id = portal_chat_messages.portal_token_id
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
      AND cpt.project_id = portal_chat_messages.project_id
      AND (portal_chat_messages.company_id IS NULL OR portal_chat_messages.company_id = cpt.company_id)
  )
);

-- Staff can read/insert chat when they have project company access (doesn't rely on company_id being present on the row)
DROP POLICY IF EXISTS "Staff can view portal chat" ON public.portal_chat_messages;
CREATE POLICY "Staff can view portal chat"
ON public.portal_chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = portal_chat_messages.project_id
      AND p.deleted_at IS NULL
      AND public.has_company_access(p.company_id)
  )
);

DROP POLICY IF EXISTS "Staff can insert portal chat" ON public.portal_chat_messages;
CREATE POLICY "Staff can insert portal chat"
ON public.portal_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = portal_chat_messages.project_id
      AND p.deleted_at IS NULL
      AND public.has_company_access(p.company_id)
  )
);

-- portal_view_logs: restrict public insert to valid portal tokens
DROP POLICY IF EXISTS "Public can insert view logs" ON public.portal_view_logs;
CREATE POLICY "Public can insert view logs"
ON public.portal_view_logs
FOR INSERT
TO public
WITH CHECK (
  portal_token_id IS NOT NULL
  AND (
    EXISTS (
      SELECT 1
      FROM public.client_portal_tokens cpt
      WHERE cpt.id = portal_view_logs.portal_token_id
        AND cpt.is_active = true
        AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
        AND (portal_view_logs.project_id IS NULL OR portal_view_logs.project_id = cpt.project_id)
        AND (portal_view_logs.estimate_id IS NULL OR portal_view_logs.estimate_id = cpt.estimate_id)
        AND (portal_view_logs.company_id IS NULL OR cpt.company_id IS NULL OR portal_view_logs.company_id = cpt.company_id)
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.estimate_portal_tokens ept
      WHERE ept.id = portal_view_logs.portal_token_id
        AND ept.is_active = true
        AND (ept.expires_at IS NULL OR ept.expires_at > now())
        AND (portal_view_logs.estimate_id IS NULL OR portal_view_logs.estimate_id = ept.estimate_id)
        AND (portal_view_logs.company_id IS NULL OR ept.company_id IS NULL OR portal_view_logs.company_id = ept.company_id)
    )
  )
);

-- project_notification_log: restrict insert to company access (and require auth)
DROP POLICY IF EXISTS "Authenticated users can insert notification logs" ON public.project_notification_log;
CREATE POLICY "Authenticated users can insert notification logs"
ON public.project_notification_log
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND company_id IS NOT NULL
  AND public.has_company_access(company_id)
  AND (sent_by IS NULL OR sent_by = auth.uid())
);
