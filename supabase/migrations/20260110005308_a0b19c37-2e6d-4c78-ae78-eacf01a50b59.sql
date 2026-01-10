-- Add void-related columns to project_bills table
ALTER TABLE public.project_bills
ADD COLUMN is_voided boolean NOT NULL DEFAULT false,
ADD COLUMN voided_at timestamp with time zone,
ADD COLUMN voided_by uuid REFERENCES public.profiles(id),
ADD COLUMN void_reason text;

-- Create index for performance when filtering voided bills
CREATE INDEX idx_project_bills_is_voided ON public.project_bills(is_voided);