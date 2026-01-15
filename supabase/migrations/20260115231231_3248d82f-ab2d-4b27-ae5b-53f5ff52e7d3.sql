-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Portal can read estimate via token" ON public.estimates;

-- Create a new policy that allows reading estimates either:
-- 1. Directly linked via estimate_id, OR
-- 2. Linked to the same project_id as the token
CREATE POLICY "Portal can read estimate via token"
ON public.estimates
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM client_portal_tokens
    WHERE client_portal_tokens.is_active = true
    AND (client_portal_tokens.expires_at IS NULL OR client_portal_tokens.expires_at > now())
    AND (
      -- Direct estimate link
      client_portal_tokens.estimate_id = estimates.id
      OR
      -- Project link - allows seeing all estimates for the project
      (client_portal_tokens.project_id IS NOT NULL AND client_portal_tokens.project_id = estimates.project_id)
    )
  )
);

-- Also update the update policy to work the same way
DROP POLICY IF EXISTS "Portal can update estimate status via token" ON public.estimates;

CREATE POLICY "Portal can update estimate status via token"
ON public.estimates
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM client_portal_tokens
    WHERE client_portal_tokens.is_active = true
    AND (client_portal_tokens.expires_at IS NULL OR client_portal_tokens.expires_at > now())
    AND (
      client_portal_tokens.estimate_id = estimates.id
      OR
      (client_portal_tokens.project_id IS NOT NULL AND client_portal_tokens.project_id = estimates.project_id)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_portal_tokens
    WHERE client_portal_tokens.is_active = true
    AND (client_portal_tokens.expires_at IS NULL OR client_portal_tokens.expires_at > now())
    AND (
      client_portal_tokens.estimate_id = estimates.id
      OR
      (client_portal_tokens.project_id IS NOT NULL AND client_portal_tokens.project_id = estimates.project_id)
    )
  )
);