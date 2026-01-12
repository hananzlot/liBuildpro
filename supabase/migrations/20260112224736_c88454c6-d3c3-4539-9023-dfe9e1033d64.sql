-- Link Project #16's "Final Completion" phase to Agreement #1204
UPDATE project_payment_phases 
SET agreement_id = 'dd0fb360-1d8e-4ae2-b860-c38cec450a5f'
WHERE id = 'f449917f-51d2-46d0-b754-04d582edfc6e';

-- Delete the test "sdd" phase from Project #18
DELETE FROM project_payment_phases 
WHERE id = 'bdd3cb7a-078f-4285-b7e5-32522b609b64';