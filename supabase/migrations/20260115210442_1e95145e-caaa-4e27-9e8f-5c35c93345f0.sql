-- Add DELETE policy for portal_chat_messages for admins
CREATE POLICY "Admins can delete portal chat messages"
ON public.portal_chat_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND (u.raw_user_meta_data->>'role' IN ('admin', 'super_admin'))
  )
);

-- Add DELETE policy for portal_chat_messages_archived for admins (if not exists)
DROP POLICY IF EXISTS "Admins can delete archived chats" ON public.portal_chat_messages_archived;
CREATE POLICY "Admins can delete archived chats"
ON public.portal_chat_messages_archived
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND (u.raw_user_meta_data->>'role' IN ('admin', 'super_admin'))
  )
);