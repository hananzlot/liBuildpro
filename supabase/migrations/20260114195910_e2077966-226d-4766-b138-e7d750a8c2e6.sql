-- Update the cloned estimate to have a unique number
UPDATE estimates SET estimate_number = 2002 WHERE id = '8f86d81d-cce0-46e6-a8ba-42792ec332a4';

-- Set sequence to continue after the new max
SELECT setval('estimates_estimate_number_seq', 2002);