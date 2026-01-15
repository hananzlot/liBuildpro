-- Create storage bucket for contract PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload contract PDFs
CREATE POLICY "Allow authenticated users to upload contracts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contracts');

-- Allow public read access to contracts (for portal viewing)
CREATE POLICY "Allow public read access to contracts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'contracts');

-- Allow authenticated users to delete contracts
CREATE POLICY "Allow authenticated users to delete contracts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'contracts');

-- Also allow anon to upload (for portal signing)
CREATE POLICY "Allow anon to upload contracts"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'contracts');