

## Better Email Onboarding: One Platform Account, Many Company Domains

### The Core Insight

You do **not** need a separate Resend account per company. Resend supports **multiple verified domains under a single account**. You can send emails on behalf of any company using your one platform API key — each company just needs to add DNS records to verify their domain.

### Current (Inefficient) Flow

1. Each company creates their own Resend account
2. They generate an API key
3. They paste it into your admin UI
4. You encrypt and store it per company
5. Edge functions try the company key, then fall back to the platform key

### Proposed (Streamlined) Flow

1. **You** maintain one Resend account with one API key (the platform `RESEND_API_KEY`)
2. When onboarding a company, they provide their domain (e.g., `zbrosgroup.com`)
3. Your app calls the Resend API to programmatically add the domain and get DNS records
4. The company adds the DNS records (SPF, DKIM, DMARC) — you show them in-app
5. Your app polls Resend to check verification status
6. Once verified, emails send from `noreply@theircompany.com` using **your** single API key

### What Changes

**New: Company Email Domain Onboarding UI**
- Admin settings page per company: "Enter your email domain"
- Calls Resend's `POST /domains` API to register the domain
- Displays the required DNS records (TXT, CNAME) for the company to add
- "Check Verification" button that calls Resend's `GET /domains/{id}` to check status
- Stores domain + verification status in `company_settings`

**New: Edge Function `manage-email-domain`**
- Handles domain registration, verification checking, and deletion via the Resend API
- Uses the single platform `RESEND_API_KEY` — no per-company keys needed

**Simplified: Email Sending**
- All 10 business email functions use the platform `RESEND_API_KEY`
- The "from" address is built dynamically: `noreply@{company_domain}` or falls back to the platform default
- Remove the per-company encrypted key infrastructure (`store_resend_api_key_encrypted`, `get_resend_api_key_encrypted`, `get-resend-key.ts`)

**Database Changes**
- Add `company_settings` entries for `email_domain`, `email_domain_resend_id`, `email_domain_verified`, `email_from_name`
- Or a new `company_email_domains` table with columns: `company_id`, `domain`, `resend_domain_id`, `verified`, `dns_records` (JSONB), `verified_at`

### Onboarding Experience

```text
Company Admin Settings → Email Setup

┌──────────────────────────────────────────┐
│  Email Domain: zbrosgroup.com    [Save]  │
│                                          │
│  Status: ⏳ Pending DNS verification     │
│                                          │
│  Add these DNS records:                  │
│  ┌──────────────────────────────────┐    │
│  │ Type: TXT                        │    │
│  │ Host: _resend.zbrosgroup.com     │    │
│  │ Value: v=spf1 include:...        │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │ Type: CNAME                      │    │
│  │ Host: resend._domainkey...       │    │
│  │ Value: ...                       │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [Check Verification]                    │
│                                          │
│  Once verified, emails will be sent      │
│  from: noreply@zbrosgroup.com            │
└──────────────────────────────────────────┘
```

### Auth Emails (Separate Concern)

For auth emails (signup, password reset, magic links), use Lovable's managed auth email system — this is completely separate from business/portal emails and needs no Resend at all.

### Implementation Steps

1. Create `company_email_domains` table with domain, Resend domain ID, verification status, DNS records
2. Create `manage-email-domain` edge function (register domain, check verification, delete)
3. Build company-level email domain setup UI with DNS record display
4. Update `_shared/get-resend-key.ts` to always use the platform key and look up the company's verified domain for the "from" address
5. Remove per-company Resend API key encryption infrastructure
6. Set up Lovable managed auth emails for auth-related emails

### Technical Details

- Resend API for domain management: `POST /domains`, `GET /domains/{id}`, `DELETE /domains/{id}`
- DNS records returned by Resend include SPF, DKIM, and optionally DMARC — all displayed to the company admin
- The platform `RESEND_API_KEY` env var (already exists) is the only key needed
- Fallback: companies without a verified domain use your platform default sender (e.g., `noreply@zbrosgroup.com`)

