-- Add qb_doc_number column to quickbooks_sync_log to store check numbers for bill payments
ALTER TABLE public.quickbooks_sync_log 
ADD COLUMN IF NOT EXISTS qb_doc_number TEXT;

-- Add an index for faster lookups by doc number
CREATE INDEX IF NOT EXISTS idx_quickbooks_sync_log_doc_number 
ON public.quickbooks_sync_log(company_id, record_type, qb_doc_number) 
WHERE qb_doc_number IS NOT NULL;