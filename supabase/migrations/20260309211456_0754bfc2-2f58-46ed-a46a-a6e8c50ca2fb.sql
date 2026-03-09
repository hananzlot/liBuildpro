-- Switch CA Pro Builders to use platform shared domain (Quick Setup)
-- This will make emails come from "CA Pro Builders via iBuildPro <noreply@emails.zbrosgroup.com>"
-- with reply-to set to info@ca-probuilders.com
INSERT INTO company_email_domains (company_id, domain, use_platform_domain, from_name, reply_to_email, verified, from_email)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'ca-probuilders.com',
  true,
  'CA Pro Builders',
  'info@ca-probuilders.com',
  false,
  'info@ca-probuilders.com'
)
ON CONFLICT (company_id) DO UPDATE SET
  use_platform_domain = true,
  from_name = 'CA Pro Builders',
  reply_to_email = 'info@ca-probuilders.com',
  updated_at = now();