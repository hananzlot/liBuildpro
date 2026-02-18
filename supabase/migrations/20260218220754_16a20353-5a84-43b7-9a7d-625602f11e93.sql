
-- Add INSERT policy on appointments for all authenticated company users
-- Non-admin roles (dispatch, sales, production, contract_manager) need this
-- to insert via edge functions that run with the service role key, AND for
-- direct client-side inserts if they ever occur.
CREATE POLICY "Company users can insert appointments"
  ON public.appointments
  FOR INSERT
  WITH CHECK (has_company_access(company_id));
