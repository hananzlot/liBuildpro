-- Fix Project #49 (Jason Goldberg) - link to opportunity from estimate
UPDATE projects 
SET opportunity_id = 'ZbS9KBqdeXNByriD1bmj',
    opportunity_uuid = '00e849f1-5a8c-4a49-80ad-2ce81f03b0cc'
WHERE id = '87e9abb3-e481-4dd5-9e33-dfa66d96fc56';

-- Fix Project #51 (Brendan/Mimi) - link to opportunity from estimate
UPDATE projects 
SET opportunity_id = 'NbHIQpYeYSYye9J3C04D',
    opportunity_uuid = '4685836b-3180-440c-933d-0d7bbcfbfe6c'
WHERE id = '75e1db18-ba53-4eeb-badd-ebd6ebe0ece0';

-- Fix Project #52 (Narges) - link to opportunity
UPDATE projects 
SET opportunity_id = 'local_opp_1769396889548_bpe47e7',
    opportunity_uuid = '16506872-968a-477c-9795-5524f83369f0'
WHERE id = '7719ca32-72dc-482d-9649-f6a9fdc8cb95';

-- Fix Estimate EST-2046 (Narges) - link to opportunity
UPDATE estimates 
SET opportunity_id = 'local_opp_1769396889548_bpe47e7',
    opportunity_uuid = '16506872-968a-477c-9795-5524f83369f0'
WHERE id = '45fdb326-4283-4f97-879b-6839240e1af0';