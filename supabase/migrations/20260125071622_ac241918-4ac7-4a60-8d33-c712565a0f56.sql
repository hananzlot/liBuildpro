-- Fix appointments for Eyal salesperson: set assigned_user_id to match ghl_user_id
UPDATE appointments 
SET assigned_user_id = 'HGpxnVy7N9ruA359ACXG' 
WHERE company_id = '00000000-0000-0000-0000-000000000002' 
AND salesperson_id = '7c04d5be-0d24-4b47-bb9c-370cbb901739' 
AND (assigned_user_id IS NULL OR assigned_user_id = '');