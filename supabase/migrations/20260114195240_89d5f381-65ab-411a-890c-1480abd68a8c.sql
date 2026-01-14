-- Update the sequence for estimate_number to start at 2001
ALTER SEQUENCE estimates_estimate_number_seq RESTART WITH 2001;

-- Update existing estimates to have numbers starting from 2001
UPDATE estimates SET estimate_number = estimate_number + 1999;