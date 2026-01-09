-- Add lead_cost_percent to projects table with default 18%
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS lead_cost_percent numeric DEFAULT 18;

-- Add profit_split_percent for each salesperson (their share of profit after lead cost and bills)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS primary_profit_split_pct numeric DEFAULT 0;

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS secondary_profit_split_pct numeric DEFAULT 0;

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS tertiary_profit_split_pct numeric DEFAULT 0;

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS quaternary_profit_split_pct numeric DEFAULT 0;