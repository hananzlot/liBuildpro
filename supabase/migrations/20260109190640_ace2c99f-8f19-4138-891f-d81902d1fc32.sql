-- Add won_at column to opportunities table
ALTER TABLE opportunities ADD COLUMN won_at timestamp with time zone DEFAULT NULL;

-- Backfill existing won opportunities with ghl_date_updated as the best approximation
UPDATE opportunities 
SET won_at = ghl_date_updated 
WHERE status = 'won' AND won_at IS NULL;

-- Add index for efficient queries on won_at
CREATE INDEX idx_opportunities_won_at ON opportunities(won_at) WHERE won_at IS NOT NULL;