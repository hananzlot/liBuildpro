-- Backfill sync log: Mark all existing invoices as synced
INSERT INTO public.quickbooks_sync_log (company_id, record_type, record_id, quickbooks_id, sync_status, synced_at)
SELECT 
  company_id,
  'invoice',
  id,
  'backfill-' || id::text,
  'synced',
  NOW()
FROM public.project_invoices
WHERE company_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill sync log: Mark all existing payments as synced  
INSERT INTO public.quickbooks_sync_log (company_id, record_type, record_id, quickbooks_id, sync_status, synced_at)
SELECT 
  company_id,
  'payment',
  id,
  'backfill-' || id::text,
  'synced',
  NOW()
FROM public.project_payments
WHERE company_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill sync log: Mark all existing bills as synced
INSERT INTO public.quickbooks_sync_log (company_id, record_type, record_id, quickbooks_id, sync_status, synced_at)
SELECT 
  company_id,
  'bill',
  id,
  'backfill-' || id::text,
  'synced',
  NOW()
FROM public.project_bills
WHERE company_id IS NOT NULL
ON CONFLICT DO NOTHING;