-- Update abandoned opportunities back to open where stage is not Lost/DNC
UPDATE opportunities 
SET status = 'open', updated_at = now() 
WHERE status = 'abandoned' 
AND (stage_name IS NULL OR stage_name != 'Lost/DNC');