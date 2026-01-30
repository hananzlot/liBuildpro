
-- Fix the bill that didn't get updated due to the status column error
UPDATE project_bills 
SET amount_paid = 3.75, balance = 10 - 3.75
WHERE id = 'c73f435d-1b20-4b81-a30d-b7ef137f0d63';
