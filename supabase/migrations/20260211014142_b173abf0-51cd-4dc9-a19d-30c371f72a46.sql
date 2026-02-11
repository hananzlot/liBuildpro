-- Add sq_ft_to_build, garage_sq_ft, and finishing_grade columns to estimates
ALTER TABLE public.estimates
ADD COLUMN sq_ft_to_build text,
ADD COLUMN garage_sq_ft text,
ADD COLUMN finishing_grade text;