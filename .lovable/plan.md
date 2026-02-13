

# Replicate CA Pro Builders Data to Demo Co #1

## Overview
Copy all records from CA Pro Builders (source) to Demo Co #1 (target) across 30+ tables, including admin settings and encrypted API keys (Resend, Twilio, OpenAI). Demo Co #1's existing data will be cleared first. GHL-specific data will be skipped.

## Scope Summary

| Category | Tables | Approx Records |
|----------|--------|----------------|
| CRM Core | contacts, opportunities, appointments | ~2,750 |
| Tasks | tasks, contact_notes | ~2,512 |
| Projects | projects, project_notes, project_documents, project_agreements | ~173 |
| Financials | project_invoices, project_payments, project_bills, bill_payments, project_costs, project_payment_phases | ~490 |
| Estimates | estimates, estimate_groups, estimate_line_items, estimate_payment_schedule | ~826 |
| Portal | client_portal_tokens, portal_chat_messages | ~74 |
| Config | company_settings (46), pipeline_stages (10), salespeople (15), subcontractors (25), trades (15), banks (3), lead_sources (2), project_statuses (8), project_types (21), archived_sources (8) | ~153 |
| Documents | compliance_document_templates, compliance_template_fields, project_documents | ~99 |
| Other | short_links, magazine_sales, scope_submissions, notifications | ~2,030 |

## Technical Approach

### Why an Edge Function?
This operation requires:
- Generating new UUIDs for every copied record
- Maintaining a UUID mapping table so foreign key references (contact_uuid, opportunity_uuid, project_id, estimate_id, etc.) point to the correct new records
- Handling 8,000+ records across 30+ tables in the correct dependency order
- Copying encrypted API keys by reading from source company settings and writing to target

### Implementation: `replicate-company-data` Edge Function

**Step 1 -- Clear Demo Co #1 data** (delete in reverse dependency order):
- Child tables first (bill_payments, estimate_line_items, estimate_groups, etc.)
- Then parent tables (projects, estimates, contacts, opportunities, etc.)
- Then config tables (company_settings, pipeline_stages, salespeople, etc.)

**Step 2 -- Copy config/reference tables** (no foreign key remapping needed):
- company_settings (all 46 rows, including encrypted Resend/Twilio/OpenAI keys)
- pipeline_stages, salespeople, subcontractors, trades, banks, lead_sources
- project_statuses, project_types, archived_sources
- compliance_document_templates and compliance_template_fields

**Step 3 -- Copy CRM core tables** (build UUID mapping):
1. **contacts** -- generate new UUIDs, store old-to-new mapping
2. **opportunities** -- remap contact_uuid using mapping
3. **appointments** -- remap contact_uuid using mapping

**Step 4 -- Copy project-related tables:**
1. **projects** -- remap contact_uuid, opportunity_uuid
2. **project_notes, project_agreements, project_documents** -- remap project_id
3. **project_invoices** -- remap project_id
4. **project_payments** -- remap project_id, invoice_id
5. **project_bills** -- remap project_id
6. **bill_payments** -- remap bill_id
7. **project_costs, project_payment_phases** -- remap project_id

**Step 5 -- Copy estimate tables:**
1. **estimates** -- remap contact_uuid, project_id, opportunity_id
2. **estimate_groups** -- remap estimate_id
3. **estimate_line_items** -- remap estimate_id, group_id
4. **estimate_payment_schedule** -- remap estimate_id

**Step 6 -- Copy remaining tables:**
- contact_notes (remap contact_uuid)
- tasks (remap contact_uuid, project_id)
- client_portal_tokens (remap project_id, estimate_id)
- portal_chat_messages (remap project_id)
- short_links (remap, or skip if desired)
- magazine_sales, scope_submissions, notifications

### API Key Handling
For encrypted keys (resend_api_key_encrypted, twilio_account_sid, twilio_auth_token, twilio_phone_number), the function will:
1. Read the decrypted values from CA Pro Builders using the existing `get_resend_api_key_encrypted` and similar RPC functions
2. Store them into Demo Co #1 using `store_resend_api_key_encrypted` and direct inserts for Twilio keys
3. For plain-text settings (openai_api_key, resend_api_key), copy the values directly

### Skipped Tables
- ghl_tasks, ghl_sync_exclusions, ghl_field_mappings, company_integrations (GHL)
- google_calendar_connections, quickbooks_connections (integration-specific)
- audit_logs, notifications (transient/historical)
- profiles, user_roles (user-specific)
- estimate_drafts, estimate_generation_queue (ephemeral)

### Safety
- The edge function will use a Supabase service role client for full access
- It will run in a single invocation with sequential table processing
- Errors at any step will be logged and returned in the response
- The function is one-time use and can be deleted after execution

## Files to Create/Modify
1. **`supabase/functions/replicate-company-data/index.ts`** -- New edge function
2. **`supabase/config.toml`** -- Add function entry with `verify_jwt = false` (admin-only, protected by service role)

