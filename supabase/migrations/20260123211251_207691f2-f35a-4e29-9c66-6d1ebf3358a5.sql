-- Link estimate to the new opportunity
UPDATE estimates 
SET opportunity_id = 'local_d9a248c3-9871-4ef0-8cb0-98094d988f77',
    opportunity_uuid = '1d56e02e-e849-48e8-a566-c9564a85f10a'
WHERE id = '9cf3dc15-7fcd-4d03-b76a-46481d99b0d5';

-- Link the second estimate too
UPDATE estimates 
SET opportunity_id = 'local_d9a248c3-9871-4ef0-8cb0-98094d988f77',
    opportunity_uuid = '1d56e02e-e849-48e8-a566-c9564a85f10a'
WHERE id = '2eff549e-6b2b-4f39-8aab-250e5a3ab415';

-- Link project to the new opportunity
UPDATE projects 
SET opportunity_id = 'local_d9a248c3-9871-4ef0-8cb0-98094d988f77',
    opportunity_uuid = '1d56e02e-e849-48e8-a566-c9564a85f10a'
WHERE id = 'fcac283f-aff4-4e27-91e0-9bd4509063ce';