-- Drop existing DELETE policies that use incorrect role checking
DROP POLICY IF EXISTS "Admins can delete portal chat messages" ON public.portal_chat_messages;
DROP POLICY IF EXISTS "Admins can delete archived chats" ON public.portal_chat_messages_archived;

-- Also update the SELECT policy for archived chats
DROP POLICY IF EXISTS "Admins can view archived chats" ON public.portal_chat_messages_archived;

-- Create new DELETE policy for portal_chat_messages using user_roles table
CREATE POLICY "Admins can delete portal chat messages"
ON public.portal_chat_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- Create new DELETE policy for portal_chat_messages_archived using user_roles table
CREATE POLICY "Admins can delete archived chats"
ON public.portal_chat_messages_archived
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- Create new SELECT policy for portal_chat_messages_archived using user_roles table
CREATE POLICY "Admins can view archived chats"
ON public.portal_chat_messages_archived
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);