-- Add plans_file_url column to store uploaded construction plans
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS plans_file_url TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.estimates.plans_file_url IS 'URL to uploaded construction plans file (PDF/images) stored in estimate-plans bucket';

-- Create storage bucket for estimate plan files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estimate-plans', 
  'estimate-plans', 
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for estimate-plans bucket
-- Authenticated users can upload files
CREATE POLICY "Authenticated users can upload estimate plans"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'estimate-plans');

-- Authenticated users can view their company's files
CREATE POLICY "Authenticated users can view estimate plans"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'estimate-plans');

-- Authenticated users can delete their company's files
CREATE POLICY "Authenticated users can delete estimate plans"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'estimate-plans');