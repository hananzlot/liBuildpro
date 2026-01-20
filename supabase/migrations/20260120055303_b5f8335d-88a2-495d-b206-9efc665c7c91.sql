-- Add features_override column to company_subscriptions for per-company feature customization
ALTER TABLE public.company_subscriptions 
ADD COLUMN IF NOT EXISTS features_override JSONB DEFAULT NULL;

-- Add corporation_id to profiles for corp-level admins (who aren't tied to a specific company)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS corporation_id UUID REFERENCES public.corporations(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_corporation_id ON public.profiles(corporation_id);

-- Add comment for clarity
COMMENT ON COLUMN public.company_subscriptions.features_override IS 'Override plan features for this company. Keys match plan features. NULL means use plan defaults.';
COMMENT ON COLUMN public.profiles.corporation_id IS 'For corp-level admins who can access all companies in a corporation';