

## Current State

The Invoice Dialog (admin side in `FinanceSection.tsx`) pulls company name, address, logo, phone, and email from `useAuth().company`, which reads from the **`companies` table**. However, that table has **null values** for address, phone, and logo_url for all companies.

The actual company branding data lives in the **`company_settings` table** (keys: `company_name`, `company_address`, `company_phone`, `company_logo_url`, `company_website`). The client portal already correctly reads from `company_settings`.

## Plan

**Update the InvoiceDialog** (inside `FinanceSection.tsx`) to fetch company branding from `company_settings` instead of relying on `useAuth().company`.

### Implementation

1. **Add a query inside `InvoiceDialog`** to fetch company settings:
   - Query `company_settings` for keys: `company_name`, `company_address`, `company_phone`, `company_logo_url`
   - Use `dialogCompanyId` (already available) as the filter
   - Fall back to `company` from `useAuth()` if settings not found

2. **Replace references** in the header bar (lines ~5663-5676):
   - `company?.logo_url` → fetched `company_logo_url` setting
   - `company?.name` → fetched `company_name` setting
   - `company?.address` → fetched `company_address` setting
   - `company?.phone` → fetched `company_phone` setting

This ensures the invoice dialog displays the same company info that users configure in Settings, matching the portal behavior.

