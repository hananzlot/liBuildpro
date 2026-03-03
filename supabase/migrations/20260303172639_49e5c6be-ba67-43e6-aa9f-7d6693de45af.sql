
ALTER TABLE public.company_email_domains 
  ADD COLUMN IF NOT EXISTS use_platform_domain boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply_to_email text;
