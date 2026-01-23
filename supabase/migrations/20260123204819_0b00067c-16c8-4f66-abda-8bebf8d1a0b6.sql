-- Step 1: Update the Facebook opportunity with scope from manual entry
UPDATE opportunities 
SET scope_of_work = '82 linear ft pool
32 linear ft jacuzzi

Paint Coping 
Redo Tile 
Pebble Replaster'
WHERE id = '00e849f1-5a8c-4a49-80ad-2ce81f03b0cc';

-- Step 2: Link the estimate to the Facebook opportunity using ghl_id (FK references opportunities.ghl_id)
UPDATE estimates 
SET opportunity_id = 'ZbS9KBqdeXNByriD1bmj',
    opportunity_uuid = '00e849f1-5a8c-4a49-80ad-2ce81f03b0cc'
WHERE id = '012a6f67-0367-4537-a8c6-29e12fcda3f6';

-- Step 3: Delete the duplicate manual opportunity
DELETE FROM opportunities 
WHERE id = 'fe252d9f-924d-4ff5-b556-cfc68f692188';

-- Step 4: Delete the local contact created for the manual entry (using correct UUID)
DELETE FROM contacts 
WHERE id = '1f015232-fc23-4034-b233-3888d8af254f';