-- Add void columns to project_payments table
ALTER TABLE public.project_payments
ADD COLUMN is_voided boolean NOT NULL DEFAULT false,
ADD COLUMN voided_at timestamp with time zone,
ADD COLUMN voided_by uuid REFERENCES public.profiles(id),
ADD COLUMN void_reason text;

-- Create index for performance
CREATE INDEX idx_project_payments_is_voided ON public.project_payments(is_voided);