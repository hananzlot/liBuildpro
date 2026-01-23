-- Amal Alwan #2040
UPDATE estimates SET 
  opportunity_id = 'XZiePDqH3fSdHnliMqIQ', 
  opportunity_uuid = 'b032df3f-12d6-44ba-8a8f-95e9254cc453',
  contact_id = 'JIRFE04UfsIxH6Osst8B',
  contact_uuid = '2753b6cb-2212-485b-9df8-a8d80816be12'
WHERE id = 'b5ce1ee2-6c01-4bea-99c6-adfd4803bc15';

-- Mariana Winer (4 estimates)
UPDATE estimates SET 
  opportunity_id = 'z0yR4vBMDT5gz8779d90', 
  opportunity_uuid = '23ffda2c-98e2-43ef-86b3-35681c242508',
  contact_id = 'rE4jyRZKxwuvhlvlPxQW',
  contact_uuid = '59a62495-ef81-401f-81e4-384bfa72b7ac'
WHERE id IN (
  'c3176819-3354-4bed-8bfc-7afb7697c913',
  'd2b327a7-43b8-4839-ac51-25e0d3070832',
  '8a805771-6ea6-4b02-a8b8-2756d4af0d9c',
  'ab85f928-eff3-415a-ac43-5c75d5f9a776'
);

-- Steven Fowler #2030
UPDATE estimates SET 
  opportunity_id = '17Aky85slfKpaIAXiDGR', 
  opportunity_uuid = '72477829-5c97-4600-a0e3-73fc40cfa1f0',
  contact_id = 'qAsKvkaeHQSxBWa7Dl0W',
  contact_uuid = '7f0e7a4a-143a-4fea-83da-114b2cc06ba0'
WHERE id = 'fa552a21-1fd8-4409-a6b1-04a9f23fd199';

-- Rob & Erin Macintyre #2025
UPDATE estimates SET 
  opportunity_id = 'VO8y4MzvqqDr2V5ZDUQo', 
  opportunity_uuid = '07c03d61-7280-4810-982a-f144d29ac175',
  contact_id = 'rFRJVEqUTTk05FuApIMe',
  contact_uuid = '98182d37-6507-4785-a5bf-2a4d6aebc3f2'
WHERE id = '8a12f612-e29b-4d8f-b35e-34f56ce6772b';

-- Hoyu America #2016
UPDATE estimates SET 
  opportunity_id = 'Lx2AVUQuoK5dqdkOfpie', 
  opportunity_uuid = '6ae3f113-a6e5-4bbc-b7a3-835ceca5fae4',
  contact_id = 'u9ZBZfrUv2CXkUuaDye4',
  contact_uuid = '9d10cae0-5286-437f-9578-a99f610332f0'
WHERE id = '16afddd0-c759-4735-a526-84949c35d038';

-- Update projects
UPDATE projects SET 
  opportunity_id = 'XZiePDqH3fSdHnliMqIQ', 
  opportunity_uuid = 'b032df3f-12d6-44ba-8a8f-95e9254cc453'
WHERE id = 'd255edd3-aeae-4240-838c-7899573a03fc';

UPDATE projects SET 
  opportunity_id = 'z0yR4vBMDT5gz8779d90', 
  opportunity_uuid = '23ffda2c-98e2-43ef-86b3-35681c242508'
WHERE id = '86053353-9c5d-4edd-be80-5adff2af5a8d';

UPDATE projects SET 
  opportunity_id = '17Aky85slfKpaIAXiDGR', 
  opportunity_uuid = '72477829-5c97-4600-a0e3-73fc40cfa1f0'
WHERE id = '2681f2d5-caec-4ab3-99ef-9e43ba16a93d';

UPDATE projects SET 
  opportunity_id = 'VO8y4MzvqqDr2V5ZDUQo', 
  opportunity_uuid = '07c03d61-7280-4810-982a-f144d29ac175'
WHERE id = '70733bf4-61e2-49db-8ef3-c90d6eb1cbda';

UPDATE projects SET 
  opportunity_id = 'Lx2AVUQuoK5dqdkOfpie', 
  opportunity_uuid = '6ae3f113-a6e5-4bbc-b7a3-835ceca5fae4'
WHERE id = 'e8371d79-dfde-41ca-8221-17c4d125c4f3';