-- Create table to track imported records from Location 2
CREATE TABLE public.imported_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_location_id text NOT NULL,
  source_ghl_id text NOT NULL,
  record_type text NOT NULL,
  target_ghl_id text,
  imported_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_location_id, source_ghl_id, record_type)
);

-- Enable RLS
ALTER TABLE public.imported_records ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Allow service role full access" ON public.imported_records
FOR ALL USING (true) WITH CHECK (true);

-- Allow authenticated read access
CREATE POLICY "Allow authenticated read access" ON public.imported_records
FOR SELECT USING (true);