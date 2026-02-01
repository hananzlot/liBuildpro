-- Update existing project photos to "Estimate Photo" category for estimate 2090's project
UPDATE project_documents 
SET category = 'Estimate Photo'
WHERE project_id = '63cde863-88cd-4b7b-a60c-a4715aa80b15' 
AND (file_type LIKE 'image/%' OR file_name LIKE '%.jpg' OR file_name LIKE '%.jpeg' OR file_name LIKE '%.png' OR file_name LIKE '%.gif' OR file_name LIKE '%.webp');