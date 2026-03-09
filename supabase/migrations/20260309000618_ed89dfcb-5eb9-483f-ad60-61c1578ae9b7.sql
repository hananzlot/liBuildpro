
-- Delete orphan payment phases for project 9f0fe9e0 (14 records, all with NULL agreement_id, 0 invoices, 0 payments)
DELETE FROM public.project_payment_phases
WHERE project_id = '9f0fe9e0-d480-43f5-b1a2-519b7533a884'
  AND agreement_id IS NULL;
