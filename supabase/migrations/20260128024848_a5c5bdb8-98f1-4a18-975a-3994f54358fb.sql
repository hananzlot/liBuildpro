-- Add labor_cost and material_cost columns to estimate_line_items
ALTER TABLE public.estimate_line_items
  ADD COLUMN IF NOT EXISTS labor_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS material_cost numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.estimate_line_items.labor_cost IS 'Labor cost component per unit (before markup)';
COMMENT ON COLUMN public.estimate_line_items.material_cost IS 'Material cost component per unit (before markup)';