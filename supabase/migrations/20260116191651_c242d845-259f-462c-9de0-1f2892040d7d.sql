-- Allow privileged users to delete estimate signatures (needed for estimate/contract deletion)
DROP POLICY IF EXISTS "Admin or contract_manager can delete signatures" ON public.estimate_signatures;
CREATE POLICY "Admin or contract_manager can delete signatures"
  ON public.estimate_signatures
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'contract_manager'));

-- Allow privileged users to delete portal view logs (cleanup when deleting tokens/estimates)
DROP POLICY IF EXISTS "Admin or contract_manager can delete view logs" ON public.portal_view_logs;
CREATE POLICY "Admin or contract_manager can delete view logs"
  ON public.portal_view_logs
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'contract_manager'));
