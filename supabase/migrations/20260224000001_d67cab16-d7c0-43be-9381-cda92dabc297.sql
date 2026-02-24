-- Delete bill payments associated with orphaned bills first (FK constraint)
DELETE FROM bill_payments WHERE bill_id IN (
  '94689a7f-8cce-4513-85f8-633149056542',
  'cc61a7e0-71a4-4388-abb5-381eec3410a6',
  '066ca4aa-e4a8-453f-9606-010ffad94154',
  '55597846-6f6f-4f4a-ae51-fcd87fae6f55',
  'f2d21e5c-da09-4c75-9864-2ea55cadfbde',
  'f2367ac2-5d54-4fba-ba27-7d15ea414150'
);

-- Delete QB sync logs for these bills
DELETE FROM quickbooks_sync_log WHERE record_id IN (
  '94689a7f-8cce-4513-85f8-633149056542',
  'cc61a7e0-71a4-4388-abb5-381eec3410a6',
  '066ca4aa-e4a8-453f-9606-010ffad94154',
  '55597846-6f6f-4f4a-ae51-fcd87fae6f55',
  'f2d21e5c-da09-4c75-9864-2ea55cadfbde',
  'f2367ac2-5d54-4fba-ba27-7d15ea414150'
);

-- Delete the orphaned bills
DELETE FROM project_bills WHERE id IN (
  '94689a7f-8cce-4513-85f8-633149056542',
  'cc61a7e0-71a4-4388-abb5-381eec3410a6',
  '066ca4aa-e4a8-453f-9606-010ffad94154',
  '55597846-6f6f-4f4a-ae51-fcd87fae6f55',
  'f2d21e5c-da09-4c75-9864-2ea55cadfbde',
  'f2367ac2-5d54-4fba-ba27-7d15ea414150'
);