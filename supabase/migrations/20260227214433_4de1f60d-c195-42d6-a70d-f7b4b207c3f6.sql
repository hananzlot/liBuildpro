
ALTER TABLE public.subcontractors 
ADD COLUMN needs_compliance_review boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.subcontractors.needs_compliance_review IS 'Set to true when vendor is created via Quick Add and has not been reviewed for license/insurance compliance';
