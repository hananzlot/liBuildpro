-- Update all abandoned opportunities back to open where stage is NOT Lost/DNC
UPDATE opportunities 
SET status = 'open', updated_at = NOW()
WHERE status = 'abandoned' 
AND (stage_name IS DISTINCT FROM 'Lost/DNC');