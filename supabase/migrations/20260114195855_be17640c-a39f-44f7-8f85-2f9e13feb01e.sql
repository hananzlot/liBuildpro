-- Fix the sequence to start after the current max estimate_number
SELECT setval('estimates_estimate_number_seq', (SELECT COALESCE(MAX(estimate_number), 2000) FROM estimates));