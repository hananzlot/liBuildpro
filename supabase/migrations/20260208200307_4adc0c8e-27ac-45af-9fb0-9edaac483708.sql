-- Fix RLS policy so portal visitors can see ALL messages for their project
-- including staff messages which don't have portal_token_id

DROP POLICY IF EXISTS "Portal visitors can view portal chat" ON public.portal_chat_messages;

CREATE POLICY "Portal visitors can view portal chat"
ON public.portal_chat_messages
FOR SELECT
USING (
  -- Allow viewing if the visitor has a valid token for this project
  EXISTS (
    SELECT 1
    FROM client_portal_tokens cpt
    WHERE cpt.project_id = portal_chat_messages.project_id
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > now())
  )
);