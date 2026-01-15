-- Add policies for portal (anon) users to read estimate data via valid token

-- Policy for anon to read estimates via valid portal token
CREATE POLICY "Portal can read estimate via token"
ON public.estimates
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens
    WHERE client_portal_tokens.estimate_id = estimates.id
    AND client_portal_tokens.is_active = true
    AND (client_portal_tokens.expires_at IS NULL OR client_portal_tokens.expires_at > now())
  )
);

-- Policy for anon to read estimate groups via valid portal token
CREATE POLICY "Portal can read estimate_groups via token"
ON public.estimate_groups
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens
    WHERE client_portal_tokens.estimate_id = estimate_groups.estimate_id
    AND client_portal_tokens.is_active = true
    AND (client_portal_tokens.expires_at IS NULL OR client_portal_tokens.expires_at > now())
  )
);

-- Policy for anon to read estimate line items via valid portal token
CREATE POLICY "Portal can read estimate_line_items via token"
ON public.estimate_line_items
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens cpt
    JOIN public.estimate_groups eg ON eg.estimate_id = cpt.estimate_id
    WHERE eg.id = estimate_line_items.group_id
    AND cpt.is_active = true
    AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens cpt
    WHERE cpt.estimate_id = estimate_line_items.estimate_id
    AND cpt.is_active = true
    AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
);

-- Policy for anon to read estimate payment schedule via valid portal token
CREATE POLICY "Portal can read estimate_payment_schedule via token"
ON public.estimate_payment_schedule
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens
    WHERE client_portal_tokens.estimate_id = estimate_payment_schedule.estimate_id
    AND client_portal_tokens.is_active = true
    AND (client_portal_tokens.expires_at IS NULL OR client_portal_tokens.expires_at > now())
  )
);

-- Policy for anon to read estimate signatures via valid portal token
CREATE POLICY "Portal can read estimate_signatures via token"
ON public.estimate_signatures
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens
    WHERE client_portal_tokens.estimate_id = estimate_signatures.estimate_id
    AND client_portal_tokens.is_active = true
    AND (client_portal_tokens.expires_at IS NULL OR client_portal_tokens.expires_at > now())
  )
);

-- Policy for anon to update estimates (for accepting/declining)
CREATE POLICY "Portal can update estimate status via token"
ON public.estimates
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens
    WHERE client_portal_tokens.estimate_id = estimates.id
    AND client_portal_tokens.is_active = true
    AND (client_portal_tokens.expires_at IS NULL OR client_portal_tokens.expires_at > now())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_portal_tokens
    WHERE client_portal_tokens.estimate_id = estimates.id
    AND client_portal_tokens.is_active = true
    AND (client_portal_tokens.expires_at IS NULL OR client_portal_tokens.expires_at > now())
  )
);