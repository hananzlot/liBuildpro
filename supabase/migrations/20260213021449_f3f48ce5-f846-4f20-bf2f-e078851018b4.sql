-- Update RLS policy on company_subscriptions to allow corp_admin/corp_viewer access
DROP POLICY "Company members can view their subscription" ON public.company_subscriptions;

CREATE POLICY "Company members can view their subscription"
ON public.company_subscriptions
FOR SELECT
USING (
  public.has_company_access(company_id)
);