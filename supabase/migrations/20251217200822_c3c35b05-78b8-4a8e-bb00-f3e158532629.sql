-- Update RLS policies for magazine_sales to restrict updates to creator or admin
DROP POLICY IF EXISTS "Allow authenticated update on magazine_sales" ON public.magazine_sales;

CREATE POLICY "Creator or admin can update magazine_sales"
ON public.magazine_sales
FOR UPDATE
USING (
  auth.uid() = entered_by 
  OR public.has_role(auth.uid(), 'admin')
);

-- Update delete policy similarly
DROP POLICY IF EXISTS "Allow authenticated delete on magazine_sales" ON public.magazine_sales;

CREATE POLICY "Creator or admin can delete magazine_sales"
ON public.magazine_sales
FOR DELETE
USING (
  auth.uid() = entered_by 
  OR public.has_role(auth.uid(), 'admin')
);

-- Update read policy - only magazine_editor role or admin can view
DROP POLICY IF EXISTS "Allow authenticated read access on magazine_sales" ON public.magazine_sales;

CREATE POLICY "Magazine editor or admin can read magazine_sales"
ON public.magazine_sales
FOR SELECT
USING (
  public.has_role(auth.uid(), 'magazine_editor')
  OR public.has_role(auth.uid(), 'admin')
);

-- Update insert policy - only magazine_editor or admin can insert
DROP POLICY IF EXISTS "Allow authenticated insert on magazine_sales" ON public.magazine_sales;

CREATE POLICY "Magazine editor or admin can insert magazine_sales"
ON public.magazine_sales
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'magazine_editor')
  OR public.has_role(auth.uid(), 'admin')
);

-- Same for magazine_sales_edits
DROP POLICY IF EXISTS "Allow authenticated read access on magazine_sales_edits" ON public.magazine_sales_edits;

CREATE POLICY "Magazine editor or admin can read magazine_sales_edits"
ON public.magazine_sales_edits
FOR SELECT
USING (
  public.has_role(auth.uid(), 'magazine_editor')
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Allow authenticated insert on magazine_sales_edits" ON public.magazine_sales_edits;

CREATE POLICY "Magazine editor or admin can insert magazine_sales_edits"
ON public.magazine_sales_edits
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'magazine_editor')
  OR public.has_role(auth.uid(), 'admin')
);