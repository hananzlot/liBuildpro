-- Add notes_to_customer column for customer-visible notes on proposals
ALTER TABLE estimates ADD COLUMN notes_to_customer TEXT;