-- Add sections_sold column to track which sections of a page are sold (1-8)
ALTER TABLE public.magazine_sales 
ADD COLUMN sections_sold integer[] DEFAULT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN public.magazine_sales.sections_sold IS 'Array of section numbers (1-8) that are sold. Each page is divided into 8 equal sections in a 2x4 grid.';
