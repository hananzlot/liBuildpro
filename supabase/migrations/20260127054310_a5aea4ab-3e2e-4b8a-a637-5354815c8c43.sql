-- Update storage bucket to allow larger files (100MB max - individual companies can set lower limits via settings)
UPDATE storage.buckets 
SET file_size_limit = 104857600 
WHERE id = 'estimate-plans';