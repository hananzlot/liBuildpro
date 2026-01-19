-- Add toggle to show/hide line items entirely (separate from showing details)
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS show_line_items_to_customer BOOLEAN NOT NULL DEFAULT false;