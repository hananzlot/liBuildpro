-- Increase the estimate-plans bucket file size limit to 200MB
UPDATE storage.buckets 
SET file_size_limit = 200 * 1024 * 1024  -- 200MB in bytes
WHERE id = 'estimate-plans';