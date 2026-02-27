-- Delete orphan payment phases (agreement_id IS NULL) for project 123
DELETE FROM project_payment_phases 
WHERE project_id = '9bf82da9-d6e0-4bfc-9b4e-997332dd9364' 
AND agreement_id IS NULL;