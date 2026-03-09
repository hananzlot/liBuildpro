
-- Delete 1 orphan payment phase for project #57 (f36e9bb8), $99, no agreement/invoices/payments
DELETE FROM public.project_payment_phases
WHERE project_id = 'f36e9bb8-99f5-4dc6-8683-d155ebbf4b98'
  AND agreement_id IS NULL;
