

## Understanding the Request

You want to allow tenant companies to optionally send emails from a subdomain of the platform's already-verified Resend domain (e.g., `noreply@companyname.zbrosgroup.com`), instead of requiring each company to verify their own domain. This way companies can start sending branded-ish emails immediately without DNS setup.

## Feasibility Analysis

**Resend's model**: Resend does not natively support "sub-accounts" or automatic email forwarding. However, there are two practical approaches:

### Option A: Subdomain-based Sending (Recommended)

Each company gets a sending identity under the platform's verified domain using a subdomain pattern:
- Platform verifies `mail.zbrosgroup.com` (or similar) once
- Companies send from `noreply@acme.mail.zbrosgroup.com` or simply `acme@mail.zbrosgroup.com`

**Problem**: Resend requires each subdomain to be separately registered and DNS-verified. So `acme.mail.zbrosgroup.com` would need its own DNS records — this doesn't save the companies any work.

### Option B: Shared Domain with Dynamic Reply-To (Most Practical)

Use the platform's single verified domain for all tenants, but customize the `reply-to` header per company:
- **From**: `"Acme Roofing via ZBros" <noreply@zbrosgroup.com>`
- **Reply-To**: `info@acmeroofing.com` (the company's real email)

This way:
- All emails send immediately (no DNS setup per company)
- Replies go to the company's real email address
- Companies can optionally upgrade to their own verified domain later
- No forwarding infrastructure needed — reply-to handles it natively

### What This Would Involve

1. **Database**: Add `reply_to_email` and `use_platform_domain` fields to `company_email_domains` or `company_settings`
2. **Edge Functions**: Update all email-sending functions (`send-proposal-email`, `send-portal-notification`, etc.) to check if a company has a verified domain — if not, fall back to the platform domain with the company's reply-to
3. **Admin UI**: Add a toggle in the Emails settings: "Use platform email domain" with a reply-to email field
4. **Email Headers**: When `use_platform_domain` is true, construct the from/reply-to dynamically:
   - `from`: `"CompanyName via Platform" <noreply@zbrosgroup.com>`
   - `reply-to`: company's configured email

### Implementation Steps

1. Add `reply_to_email` and `use_platform_domain` columns to `company_email_domains` (migration)
2. Update the `CompanyEmailDomainSetup` component to show a "Quick Start" option that lets companies enter just their reply-to email and display name, skipping DNS verification entirely
3. Update the shared `get-resend-key.ts` helper (or create a new `get-sender-config` helper) that returns the correct from/reply-to based on whether the company has a verified domain
4. Update email-sending edge functions to use this helper for dynamic sender resolution

### UX Flow

- Company opens Email settings
- Sees two options:
  - **Quick Setup**: Enter your company name and reply-to email → emails send immediately from `"Your Company via ZBros" <noreply@zbrosgroup.com>` with replies going to their email
  - **Custom Domain**: Full DNS verification flow (existing)
- Companies can switch from Quick Setup to Custom Domain at any time

