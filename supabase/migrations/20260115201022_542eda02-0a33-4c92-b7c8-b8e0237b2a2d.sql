-- Add attachment_url column to project_invoices for PDF uploads
ALTER TABLE public.project_invoices 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.project_invoices.attachment_url IS 'URL to the invoice PDF document';