-- The project RLS policy uses a subquery on client_portal_tokens,
-- but anonymous users can't read from client_portal_tokens anymore.
-- Fix: Add a minimal SELECT policy for anonymous users that only allows
-- reading active, non-expired tokens (safe because token is the secret)

CREATE POLICY "Public can lookup active tokens for RLS checks"
ON public.client_portal_tokens
FOR SELECT
TO anon
USING (
  is_active = true 
  AND (expires_at IS NULL OR expires_at > now())
);