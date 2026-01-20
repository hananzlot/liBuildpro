-- Add max_users_override to company_subscriptions for per-company limits
ALTER TABLE public.company_subscriptions 
ADD COLUMN max_users_override INTEGER DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.company_subscriptions.max_users_override IS 'Override the plan max_users for this specific company. NULL means use plan default.';