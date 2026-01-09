-- Update default values for profit split fields to 50%
ALTER TABLE public.projects 
  ALTER COLUMN primary_profit_split_pct SET DEFAULT 50,
  ALTER COLUMN secondary_profit_split_pct SET DEFAULT 50,
  ALTER COLUMN tertiary_profit_split_pct SET DEFAULT 50,
  ALTER COLUMN quaternary_profit_split_pct SET DEFAULT 50;